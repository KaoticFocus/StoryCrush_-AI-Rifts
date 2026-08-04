import { BoardCoordinate, BoardDimensions } from '../board/boardTypes';
import { BoardDomainError } from '../board/errors';
import { assertCoordinateInBounds } from '../board/boardValidation';
import { RiftHungerDefinition, RiftHungerProtectedCell, RiftHungerState } from './riftHungerTypes';
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

export { listEligibleFrontierCells, selectThreatenedCell };

function dedupeSortedCoordinates(coordinates: readonly BoardCoordinate[]): BoardCoordinate[] {
  const seen = new Set<string>();
  const result: BoardCoordinate[] = [];
  for (const coordinate of [...coordinates].sort(compareCoordinates)) {
    const key = coordinateKey(coordinate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(cloneCoordinate(coordinate));
  }
  return result;
}

/**
 * Source cells begin corrupted but do not increase hungerCurrent.
 * spreadGeneration begins at 0; countdown begins at spreadInterval when active.
 * Contained initial state uses countdown 0 (no future spread possible).
 */
export function createInitialRiftHungerState(input: {
  definition: RiftHungerDefinition;
  boardDimensions: BoardDimensions;
}): RiftHungerState {
  const definition = validateRiftHungerDefinition(input.definition, input.boardDimensions);
  const sourceCells = dedupeSortedCoordinates(definition.sourceCells);
  const corruptedCells = sourceCells.map(cloneCoordinate);
  const threatenedCell = selectThreatenedCell({
    dimensions: input.boardDimensions,
    corruptedCells,
    protectedCells: [],
  });

  const state: RiftHungerState = {
    status: threatenedCell ? 'active' : 'contained',
    sourceCells,
    corruptedCells,
    threatenedCell,
    acceptedMovesUntilSpread: threatenedCell ? definition.spreadInterval : 0,
    spreadGeneration: 0,
    hungerCurrent: 0,
    protectedCells: [],
  };

  return validateRiftHungerStateRelationship({
    definition,
    state,
    boardDimensions: input.boardDimensions,
  });
}

/**
 * Add or refresh protection for a cell. Remaining cycles must be a positive safe integer.
 * Special-creation wiring that calls this is deferred; RH-0 exposes the pure contract only.
 *
 * Preserves a valid telegraph immediately when protecting the current target.
 * Rejects final-frontier protection that would create false containment.
 */
export function addOrRefreshRiftHungerProtection(input: {
  definition: RiftHungerDefinition;
  state: RiftHungerState;
  boardDimensions: BoardDimensions;
  coordinate: BoardCoordinate;
  remainingAcceptedMoves: number;
}): RiftHungerState {
  if (!Number.isSafeInteger(input.remainingAcceptedMoves) || input.remainingAcceptedMoves <= 0) {
    throw new BoardDomainError(
      'invalid-level-state',
      `protection remainingAcceptedMoves must be a positive safe integer; received ${String(input.remainingAcceptedMoves)}`,
    );
  }

  const definition = validateRiftHungerDefinition(input.definition, input.boardDimensions);
  const previous = validateRiftHungerStateRelationship({
    definition,
    state: input.state,
    boardDimensions: input.boardDimensions,
  });

  assertCoordinateInBounds(input.coordinate, input.boardDimensions, 'protection coordinate');

  const protectKey = coordinateKey(input.coordinate);
  if (previous.corruptedCells.some((cell) => coordinateKey(cell) === protectKey)) {
    throw new BoardDomainError(
      'invalid-level-state',
      `cannot protect already corrupted cell ${protectKey}`,
    );
  }

  const next = cloneRiftHungerState(previous);
  const existingIndex = next.protectedCells.findIndex(
    (entry) => coordinateKey(entry.coordinate) === protectKey,
  );

  const entry: RiftHungerProtectedCell = {
    coordinate: cloneCoordinate(input.coordinate),
    remainingAcceptedMoves: input.remainingAcceptedMoves,
  };

  if (existingIndex >= 0) {
    next.protectedCells[existingIndex] = entry;
  } else {
    next.protectedCells.push(entry);
  }

  next.protectedCells.sort((a, b) => compareCoordinates(a.coordinate, b.coordinate));

  const uncorruptedFrontier = listEligibleFrontierCells({
    dimensions: input.boardDimensions,
    corruptedCells: next.corruptedCells,
    protectedCells: [],
  });
  const eligibleFrontier = listEligibleFrontierCells({
    dimensions: input.boardDimensions,
    corruptedCells: next.corruptedCells,
    protectedCells: next.protectedCells,
  });

  if (next.status === 'active') {
    if (eligibleFrontier.length === 0) {
      // Temporary protection must not create false containment while cells remain.
      if (uncorruptedFrontier.length > 0) {
        throw new BoardDomainError(
          'invalid-level-state',
          'cannot protect the final eligible frontier cell while uncorrupted cells remain',
        );
      }
      next.status = 'contained';
      next.threatenedCell = null;
      next.acceptedMovesUntilSpread = 0;
    } else {
      const currentThreatKey = next.threatenedCell ? coordinateKey(next.threatenedCell) : null;
      if (currentThreatKey === protectKey) {
        // Retarget immediately; preserve countdown; do not tick or spread.
        next.threatenedCell = cloneCoordinate(eligibleFrontier[0]);
      }
    }
  }

  return validateRiftHungerStateRelationship({
    definition,
    state: next,
    boardDimensions: input.boardDimensions,
  });
}

/** Decrement protection counters after an accepted-move threat advance and drop expired entries. */
export function tickRiftHungerProtection(state: RiftHungerState): RiftHungerState {
  const next = cloneRiftHungerState(state);
  next.protectedCells = next.protectedCells
    .map((entry) => ({
      coordinate: cloneCoordinate(entry.coordinate),
      remainingAcceptedMoves: entry.remainingAcceptedMoves - 1,
    }))
    .filter((entry) => entry.remainingAcceptedMoves > 0)
    .sort((a, b) => compareCoordinates(a.coordinate, b.coordinate));
  return next;
}

export function isCellProtected(state: RiftHungerState, coordinate: BoardCoordinate): boolean {
  const key = coordinateKey(coordinate);
  return state.protectedCells.some((entry) => coordinateKey(entry.coordinate) === key);
}

export function isCellCorrupted(state: RiftHungerState, coordinate: BoardCoordinate): boolean {
  const key = coordinateKey(coordinate);
  return state.corruptedCells.some((entry) => coordinateKey(entry) === key);
}
