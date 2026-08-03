import { BoardCoordinate, BoardDimensions } from '../board/boardTypes';
import { BoardDomainError } from '../board/errors';
import { assertCoordinateInBounds } from '../board/boardValidation';
import {
  RiftHungerDefinition,
  RiftHungerProtectedCell,
  RiftHungerSpreadPriority,
  RiftHungerState,
  RiftHungerStatus,
} from './riftHungerTypes';

const SUPPORTED_PRIORITIES = new Set<RiftHungerSpreadPriority>(['orthogonal-stable-coordinate']);

const SUPPORTED_STATUSES = new Set<RiftHungerStatus>(['active', 'contained', 'overwhelmed']);

function assertSafePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BoardDomainError(
      'invalid-level-definition',
      `rift hunger ${label} must be a positive safe integer; received ${String(value)}`,
    );
  }
}

function assertSafeNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BoardDomainError(
      'invalid-level-state',
      `rift hunger ${label} must be a non-negative safe integer; received ${String(value)}`,
    );
  }
}

export function cloneCoordinate(coordinate: BoardCoordinate): BoardCoordinate {
  return { row: coordinate.row, column: coordinate.column };
}

export function compareCoordinates(a: BoardCoordinate, b: BoardCoordinate): number {
  if (a.row !== b.row) {
    return a.row - b.row;
  }
  return a.column - b.column;
}

export function coordinateKey(coordinate: BoardCoordinate): string {
  return `${coordinate.row},${coordinate.column}`;
}

function validateCoordinateShape(coordinate: BoardCoordinate, label: string): void {
  if (
    !Number.isSafeInteger(coordinate.row) ||
    !Number.isSafeInteger(coordinate.column) ||
    coordinate.row < 0 ||
    coordinate.column < 0
  ) {
    throw new BoardDomainError(
      'invalid-level-definition',
      `${label} must use non-negative safe-integer coordinates; received ${JSON.stringify(coordinate)}`,
    );
  }
}

/**
 * Validate and normalize a Rift Hunger definition.
 * When board dimensions are provided, source cells are bounds-checked.
 */
export function validateRiftHungerDefinition(
  threat: RiftHungerDefinition,
  boardDimensions?: BoardDimensions,
): RiftHungerDefinition {
  if (threat.kind !== 'rift-hunger') {
    throw new BoardDomainError(
      'invalid-level-definition',
      `unsupported threat kind ${JSON.stringify((threat as { kind?: unknown }).kind)}`,
    );
  }

  if (threat.spreadPriority !== 'orthogonal-stable-coordinate') {
    throw new BoardDomainError(
      'invalid-level-definition',
      `unsupported rift hunger spreadPriority ${JSON.stringify(threat.spreadPriority)}`,
    );
  }

  if (!SUPPORTED_PRIORITIES.has(threat.spreadPriority)) {
    throw new BoardDomainError(
      'invalid-level-definition',
      `unsupported rift hunger spreadPriority ${JSON.stringify(threat.spreadPriority)}`,
    );
  }

  assertSafePositiveInteger(threat.spreadInterval, 'spreadInterval');
  assertSafePositiveInteger(threat.hungerMaximum, 'hungerMaximum');

  if (!Array.isArray(threat.sourceCells) || threat.sourceCells.length === 0) {
    throw new BoardDomainError(
      'invalid-level-definition',
      'rift hunger sourceCells must contain at least one coordinate',
    );
  }

  const seen = new Set<string>();
  const sourceCells: BoardCoordinate[] = [];
  for (const [index, coordinate] of threat.sourceCells.entries()) {
    validateCoordinateShape(coordinate, `rift hunger sourceCells[${index}]`);
    if (boardDimensions) {
      assertCoordinateInBounds(coordinate, boardDimensions, `rift hunger sourceCells[${index}]`);
    }

    const key = coordinateKey(coordinate);
    if (seen.has(key)) {
      throw new BoardDomainError(
        'invalid-level-definition',
        `duplicate rift hunger source cell ${key}`,
      );
    }
    seen.add(key);
    sourceCells.push(cloneCoordinate(coordinate));
  }

  sourceCells.sort(compareCoordinates);

  return {
    kind: 'rift-hunger',
    sourceCells,
    spreadInterval: threat.spreadInterval,
    hungerMaximum: threat.hungerMaximum,
    spreadPriority: threat.spreadPriority,
  };
}

function cloneProtectedCell(entry: RiftHungerProtectedCell): RiftHungerProtectedCell {
  return {
    coordinate: cloneCoordinate(entry.coordinate),
    remainingAcceptedMoves: entry.remainingAcceptedMoves,
  };
}

export function cloneRiftHungerState(state: RiftHungerState): RiftHungerState {
  return {
    status: state.status,
    sourceCells: state.sourceCells.map(cloneCoordinate),
    corruptedCells: state.corruptedCells.map(cloneCoordinate),
    threatenedCell: state.threatenedCell ? cloneCoordinate(state.threatenedCell) : null,
    acceptedMovesUntilSpread: state.acceptedMovesUntilSpread,
    spreadGeneration: state.spreadGeneration,
    hungerCurrent: state.hungerCurrent,
    protectedCells: state.protectedCells.map(cloneProtectedCell),
  };
}

export function validateRiftHungerState(state: RiftHungerState): RiftHungerState {
  if (!SUPPORTED_STATUSES.has(state.status)) {
    throw new BoardDomainError(
      'invalid-level-state',
      `unsupported rift hunger status ${JSON.stringify(state.status)}`,
    );
  }

  assertSafeNonNegativeInteger(state.acceptedMovesUntilSpread, 'acceptedMovesUntilSpread');
  assertSafeNonNegativeInteger(state.spreadGeneration, 'spreadGeneration');
  assertSafeNonNegativeInteger(state.hungerCurrent, 'hungerCurrent');

  if (!Array.isArray(state.sourceCells) || state.sourceCells.length === 0) {
    throw new BoardDomainError(
      'invalid-level-state',
      'rift hunger state sourceCells must be non-empty',
    );
  }

  if (!Array.isArray(state.corruptedCells)) {
    throw new BoardDomainError(
      'invalid-level-state',
      'rift hunger corruptedCells must be an array',
    );
  }

  if (!Array.isArray(state.protectedCells)) {
    throw new BoardDomainError(
      'invalid-level-state',
      'rift hunger protectedCells must be an array',
    );
  }

  for (const [index, coordinate] of state.sourceCells.entries()) {
    validateCoordinateShape(coordinate, `rift hunger state sourceCells[${index}]`);
  }
  for (const [index, coordinate] of state.corruptedCells.entries()) {
    validateCoordinateShape(coordinate, `rift hunger state corruptedCells[${index}]`);
  }
  if (state.threatenedCell) {
    validateCoordinateShape(state.threatenedCell, 'rift hunger threatenedCell');
  }
  for (const [index, entry] of state.protectedCells.entries()) {
    validateCoordinateShape(entry.coordinate, `rift hunger protectedCells[${index}]`);
    assertSafePositiveInteger(
      entry.remainingAcceptedMoves,
      `protectedCells[${index}].remainingAcceptedMoves`,
    );
  }

  return cloneRiftHungerState(state);
}
