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
  listEligibleFrontierCells,
  selectThreatenedCell,
  validateRiftHungerDefinition,
  validateRiftHungerStateRelationship,
} from './riftHungerValidation';
import { tickRiftHungerProtection } from './riftHungerState';

function isEligibleFrontierMember(input: {
  coordinate: BoardCoordinate;
  state: RiftHungerState;
  dimensions: BoardDimensions;
}): boolean {
  const frontier = listEligibleFrontierCells({
    dimensions: input.dimensions,
    corruptedCells: input.state.corruptedCells,
    protectedCells: input.state.protectedCells,
  });
  const key = coordinateKey(input.coordinate);
  return frontier.some((cell) => coordinateKey(cell) === key);
}

function hasUncorruptedOrthogonalFrontier(input: {
  state: RiftHungerState;
  dimensions: BoardDimensions;
}): boolean {
  return (
    listEligibleFrontierCells({
      dimensions: input.dimensions,
      corruptedCells: input.state.corruptedCells,
      protectedCells: [],
    }).length > 0
  );
}

/**
 * Advance Rift Hunger exactly once for an accepted authoritative move.
 *
 * Cascades inside that move do not call this again.
 * Rejected/terminal requests must not call this.
 *
 * Telegraph-lock: a validated threatened cell is retained until spread or
 * frontier ineligibility caused by protection expiry handling.
 */
export function advanceRiftHungerForAcceptedMove(input: {
  definition: RiftHungerDefinition;
  state: RiftHungerState;
  boardDimensions: BoardDimensions;
}): RiftHungerTransition {
  const definition = validateRiftHungerDefinition(input.definition, input.boardDimensions);
  const previousState = validateRiftHungerStateRelationship({
    definition,
    state: input.state,
    boardDimensions: input.boardDimensions,
  });
  const countdownBefore = previousState.acceptedMovesUntilSpread;

  if (previousState.status !== 'active') {
    const nextState = cloneRiftHungerState(previousState);
    return {
      previousState,
      nextState,
      countdownBefore,
      countdownAfter: nextState.acceptedMovesUntilSpread,
      spreadEvent: null,
      statusBefore: previousState.status,
      statusAfter: nextState.status,
    };
  }

  // Validated active state always has a locked telegraph on the eligible frontier.
  let working = cloneRiftHungerState(previousState);
  if (
    !working.threatenedCell ||
    !isEligibleFrontierMember({
      coordinate: working.threatenedCell,
      state: working,
      dimensions: input.boardDimensions,
    })
  ) {
    throw new BoardDomainError(
      'invalid-level-state',
      'active rift hunger telegraph is not an eligible frontier cell',
    );
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

    // Spread uses pre-tick protection (already reflected in the locked telegraph).
    working.corruptedCells = [...working.corruptedCells, target].sort(compareCoordinates);
    working.spreadGeneration = generationAfter;
    working.hungerCurrent = hungerAfter;

    if (hungerAfter >= definition.hungerMaximum) {
      working.status = 'overwhelmed';
      working.threatenedCell = null;
      working.acceptedMovesUntilSpread = 0;
      working = tickRiftHungerProtection(working);
      spreadEvent = {
        generation: generationAfter,
        coordinate: target,
        hungerBefore,
        hungerAfter,
        nextThreatenedCell: null,
      };
    } else {
      // Tick protection, then choose the next telegraph from post-tick eligibility.
      working = tickRiftHungerProtection(working);
      const nextThreatened = selectThreatenedCell({
        dimensions: input.boardDimensions,
        corruptedCells: working.corruptedCells,
        protectedCells: working.protectedCells,
      });
      if (!nextThreatened) {
        if (
          hasUncorruptedOrthogonalFrontier({
            state: working,
            dimensions: input.boardDimensions,
          })
        ) {
          throw new BoardDomainError(
            'invalid-level-state',
            'rift hunger cannot enter contained while uncorrupted orthogonal frontier remains',
          );
        }
        working.status = 'contained';
        working.threatenedCell = null;
        working.acceptedMovesUntilSpread = 0;
      } else {
        working.status = 'active';
        working.threatenedCell = nextThreatened;
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
    working = tickRiftHungerProtection(working);

    // Preserve the locked telegraph when it remains eligible after the tick.
    // Do not retarget merely because another protection entry expired.
    if (
      working.threatenedCell &&
      isEligibleFrontierMember({
        coordinate: working.threatenedCell,
        state: working,
        dimensions: input.boardDimensions,
      })
    ) {
      // keep lock
    } else {
      const retarget = selectThreatenedCell({
        dimensions: input.boardDimensions,
        corruptedCells: working.corruptedCells,
        protectedCells: working.protectedCells,
      });
      if (!retarget) {
        if (
          hasUncorruptedOrthogonalFrontier({
            state: working,
            dimensions: input.boardDimensions,
          })
        ) {
          throw new BoardDomainError(
            'invalid-level-state',
            'rift hunger cannot enter contained while uncorrupted orthogonal frontier remains',
          );
        }
        working.status = 'contained';
        working.threatenedCell = null;
        working.acceptedMovesUntilSpread = 0;
      } else {
        working.threatenedCell = retarget;
      }
    }
  }

  const nextState = validateRiftHungerStateRelationship({
    definition,
    state: working,
    boardDimensions: input.boardDimensions,
  });

  return {
    previousState,
    nextState,
    countdownBefore,
    countdownAfter: nextState.acceptedMovesUntilSpread,
    spreadEvent: spreadEvent
      ? {
          generation: spreadEvent.generation,
          coordinate: cloneCoordinate(spreadEvent.coordinate),
          hungerBefore: spreadEvent.hungerBefore,
          hungerAfter: spreadEvent.hungerAfter,
          nextThreatenedCell: spreadEvent.nextThreatenedCell
            ? cloneCoordinate(spreadEvent.nextThreatenedCell)
            : null,
        }
      : null,
    statusBefore: previousState.status,
    statusAfter: nextState.status,
  };
}
