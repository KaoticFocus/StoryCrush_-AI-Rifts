import { BoardCoordinate, BoardDimensions } from '../board/boardTypes';
import { BoardDomainError } from '../board/errors';
import {
  RiftHungerDefinition,
  RiftHungerSpreadEvent,
  RiftHungerState,
  RiftHungerTransition,
} from './riftHungerTypes';
import {
  cloneCoordinate,
  cloneRiftHungerState,
  compareCoordinates,
  coordinateKey,
  validateRiftHungerDefinition,
} from './riftHungerValidation';
import { selectThreatenedCell, tickRiftHungerProtection } from './riftHungerState';

function ensureTelegraphStillEligible(input: {
  state: RiftHungerState;
  dimensions: BoardDimensions;
}): BoardCoordinate | null {
  const threatened = input.state.threatenedCell;
  if (!threatened) {
    return selectThreatenedCell({
      dimensions: input.dimensions,
      corruptedCells: input.state.corruptedCells,
      protectedCells: input.state.protectedCells,
    });
  }

  const corrupted = new Set(input.state.corruptedCells.map(coordinateKey));
  const protectedKeys = new Set(
    input.state.protectedCells.map((entry) => coordinateKey(entry.coordinate)),
  );
  const key = coordinateKey(threatened);
  if (corrupted.has(key) || protectedKeys.has(key)) {
    return selectThreatenedCell({
      dimensions: input.dimensions,
      corruptedCells: input.state.corruptedCells,
      protectedCells: input.state.protectedCells,
    });
  }

  return cloneCoordinate(threatened);
}

/**
 * Advance Rift Hunger exactly once for an accepted authoritative move.
 *
 * Cascades inside that move do not call this again.
 * Rejected/terminal requests must not call this.
 *
 * Telegraph-lock: the threatened cell is retained until spread or ineligibility.
 */
export function advanceRiftHungerForAcceptedMove(input: {
  definition: RiftHungerDefinition;
  state: RiftHungerState;
  boardDimensions: BoardDimensions;
}): RiftHungerTransition {
  const definition = validateRiftHungerDefinition(input.definition, input.boardDimensions);
  const previousState = cloneRiftHungerState(input.state);
  const countdownBefore = previousState.acceptedMovesUntilSpread;

  if (previousState.status !== 'active') {
    return {
      previousState,
      nextState: cloneRiftHungerState(previousState),
      countdownBefore,
      countdownAfter: previousState.acceptedMovesUntilSpread,
      spreadEvent: null,
      statusBefore: previousState.status,
      statusAfter: previousState.status,
    };
  }

  let working = cloneRiftHungerState(previousState);
  working.threatenedCell = ensureTelegraphStillEligible({
    state: working,
    dimensions: input.boardDimensions,
  });
  if (!working.threatenedCell) {
    working.status = 'contained';
    working = tickRiftHungerProtection(working);
    return {
      previousState,
      nextState: working,
      countdownBefore,
      countdownAfter: working.acceptedMovesUntilSpread,
      spreadEvent: null,
      statusBefore: previousState.status,
      statusAfter: working.status,
    };
  }

  const nextCountdown = working.acceptedMovesUntilSpread - 1;
  if (!Number.isSafeInteger(nextCountdown) || nextCountdown < 0) {
    throw new BoardDomainError(
      'invalid-level-state',
      'rift hunger countdown cannot become negative',
    );
  }

  let spreadEvent: RiftHungerSpreadEvent | null = null;

  if (nextCountdown === 0) {
    const target = cloneCoordinate(working.threatenedCell);
    const targetKey = coordinateKey(target);
    if (working.corruptedCells.some((cell) => coordinateKey(cell) === targetKey)) {
      throw new BoardDomainError(
        'invalid-level-state',
        `rift hunger attempted duplicate corruption at ${targetKey}`,
      );
    }

    const hungerBefore = working.hungerCurrent;
    const hungerAfter = hungerBefore + 1;
    if (!Number.isSafeInteger(hungerAfter)) {
      throw new BoardDomainError(
        'invalid-level-state',
        'rift hungerCurrent overflowed safe integer range',
      );
    }

    const generationAfter = working.spreadGeneration + 1;
    if (!Number.isSafeInteger(generationAfter)) {
      throw new BoardDomainError(
        'invalid-level-state',
        'rift hunger spreadGeneration overflowed safe integer range',
      );
    }

    working.corruptedCells = [...working.corruptedCells, target].sort(compareCoordinates);
    working.spreadGeneration = generationAfter;
    working.hungerCurrent = hungerAfter;

    if (hungerAfter >= definition.hungerMaximum) {
      working.status = 'overwhelmed';
      working.threatenedCell = null;
      working.acceptedMovesUntilSpread = 0;
      spreadEvent = {
        generation: generationAfter,
        coordinate: target,
        hungerBefore,
        hungerAfter,
        nextThreatenedCell: null,
      };
    } else {
      const nextThreatened = selectThreatenedCell({
        dimensions: input.boardDimensions,
        corruptedCells: working.corruptedCells,
        protectedCells: working.protectedCells,
      });
      working.threatenedCell = nextThreatened;
      if (!nextThreatened) {
        working.status = 'contained';
        working.acceptedMovesUntilSpread = 0;
      } else {
        working.status = 'active';
        working.acceptedMovesUntilSpread = definition.spreadInterval;
      }
      spreadEvent = {
        generation: generationAfter,
        coordinate: target,
        hungerBefore,
        hungerAfter,
        nextThreatenedCell: nextThreatened ? cloneCoordinate(nextThreatened) : null,
      };
    }
  } else {
    working.acceptedMovesUntilSpread = nextCountdown;
  }

  working = tickRiftHungerProtection(working);

  // If protection tick invalidated the telegraph without a spread, retarget once.
  if (working.status === 'active' && nextCountdown !== 0) {
    working.threatenedCell = ensureTelegraphStillEligible({
      state: working,
      dimensions: input.boardDimensions,
    });
    if (!working.threatenedCell) {
      working.status = 'contained';
    }
  }

  return {
    previousState,
    nextState: cloneRiftHungerState(working),
    countdownBefore,
    countdownAfter: working.acceptedMovesUntilSpread,
    spreadEvent,
    statusBefore: previousState.status,
    statusAfter: working.status,
  };
}
