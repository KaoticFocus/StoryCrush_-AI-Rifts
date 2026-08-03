import { BoardCoordinate, BoardDimensions } from '../board/boardTypes';
import { BoardDomainError } from '../board/errors';
import { RiftHungerDefinition, RiftHungerProtectedCell, RiftHungerState } from './riftHungerTypes';
import {
  cloneCoordinate,
  cloneRiftHungerState,
  compareCoordinates,
  coordinateKey,
  validateRiftHungerDefinition,
} from './riftHungerValidation';

const ORTHOGONAL_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

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

function isInBounds(coordinate: BoardCoordinate, dimensions: BoardDimensions): boolean {
  return (
    coordinate.row >= 0 &&
    coordinate.column >= 0 &&
    coordinate.row < dimensions.rows &&
    coordinate.column < dimensions.columns
  );
}

function protectedKeySet(protectedCells: readonly RiftHungerProtectedCell[]): Set<string> {
  return new Set(protectedCells.map((entry) => coordinateKey(entry.coordinate)));
}

/**
 * Eligible orthogonal frontier in stable row-major order.
 * Excludes already corrupted and protected cells.
 */
export function listEligibleFrontierCells(input: {
  dimensions: BoardDimensions;
  corruptedCells: readonly BoardCoordinate[];
  protectedCells: readonly RiftHungerProtectedCell[];
}): BoardCoordinate[] {
  const corrupted = new Set(input.corruptedCells.map(coordinateKey));
  const protectedKeys = protectedKeySet(input.protectedCells);
  const candidates = new Map<string, BoardCoordinate>();

  for (const corruptedCell of input.corruptedCells) {
    for (const [rowDelta, columnDelta] of ORTHOGONAL_DELTAS) {
      const candidate = {
        row: corruptedCell.row + rowDelta,
        column: corruptedCell.column + columnDelta,
      };
      if (!isInBounds(candidate, input.dimensions)) {
        continue;
      }
      const key = coordinateKey(candidate);
      if (corrupted.has(key) || protectedKeys.has(key)) {
        continue;
      }
      if (!candidates.has(key)) {
        candidates.set(key, candidate);
      }
    }
  }

  return [...candidates.values()].sort(compareCoordinates).map(cloneCoordinate);
}

export function selectThreatenedCell(input: {
  dimensions: BoardDimensions;
  corruptedCells: readonly BoardCoordinate[];
  protectedCells: readonly RiftHungerProtectedCell[];
}): BoardCoordinate | null {
  const frontier = listEligibleFrontierCells(input);
  return frontier.length > 0 ? cloneCoordinate(frontier[0]) : null;
}

/**
 * Source cells begin corrupted but do not increase hungerCurrent.
 * spreadGeneration begins at 0; countdown begins at spreadInterval.
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
    acceptedMovesUntilSpread: definition.spreadInterval,
    spreadGeneration: 0,
    hungerCurrent: 0,
    protectedCells: [],
  };

  return cloneRiftHungerState(state);
}

/**
 * Add or refresh protection for a cell. Remaining cycles must be a positive safe integer.
 * Special-creation wiring that calls this is deferred; RH-0 exposes the pure contract only.
 */
export function addOrRefreshRiftHungerProtection(input: {
  state: RiftHungerState;
  coordinate: BoardCoordinate;
  remainingAcceptedMoves: number;
}): RiftHungerState {
  if (!Number.isSafeInteger(input.remainingAcceptedMoves) || input.remainingAcceptedMoves <= 0) {
    throw new BoardDomainError(
      'invalid-level-state',
      `protection remainingAcceptedMoves must be a positive safe integer; received ${String(input.remainingAcceptedMoves)}`,
    );
  }

  const next = cloneRiftHungerState(input.state);
  const key = coordinateKey(input.coordinate);
  const existingIndex = next.protectedCells.findIndex(
    (entry) => coordinateKey(entry.coordinate) === key,
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
  return next;
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
