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

const ORTHOGONAL_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function assertSafePositiveInteger(
  value: number,
  label: string,
  code: 'invalid-level-definition' | 'invalid-level-state' = 'invalid-level-definition',
): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BoardDomainError(
      code,
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

function validateCoordinateShape(
  coordinate: BoardCoordinate,
  label: string,
  code: 'invalid-level-definition' | 'invalid-level-state' = 'invalid-level-definition',
): void {
  if (
    !Number.isSafeInteger(coordinate.row) ||
    !Number.isSafeInteger(coordinate.column) ||
    coordinate.row < 0 ||
    coordinate.column < 0
  ) {
    throw new BoardDomainError(
      code,
      `${label} must use non-negative safe-integer coordinates; received ${JSON.stringify(coordinate)}`,
    );
  }
}

function isInBounds(coordinate: BoardCoordinate, dimensions: BoardDimensions): boolean {
  return (
    coordinate.row >= 0 &&
    coordinate.column >= 0 &&
    coordinate.row < dimensions.rows &&
    coordinate.column < dimensions.columns
  );
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
  const protectedKeys = new Set(
    input.protectedCells.map((entry) => coordinateKey(entry.coordinate)),
  );
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
 * Uncorrupted orthogonal frontier ignoring protection (used for contained semantics).
 */
function listUncorruptedOrthogonalFrontier(input: {
  dimensions: BoardDimensions;
  corruptedCells: readonly BoardCoordinate[];
}): BoardCoordinate[] {
  return listEligibleFrontierCells({
    dimensions: input.dimensions,
    corruptedCells: input.corruptedCells,
    protectedCells: [],
  });
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

/** Structural state checks without definition/board relationship. */
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
    validateCoordinateShape(
      coordinate,
      `rift hunger state sourceCells[${index}]`,
      'invalid-level-state',
    );
  }
  for (const [index, coordinate] of state.corruptedCells.entries()) {
    validateCoordinateShape(
      coordinate,
      `rift hunger state corruptedCells[${index}]`,
      'invalid-level-state',
    );
  }
  if (state.threatenedCell) {
    validateCoordinateShape(
      state.threatenedCell,
      'rift hunger threatenedCell',
      'invalid-level-state',
    );
  }
  for (const [index, entry] of state.protectedCells.entries()) {
    validateCoordinateShape(
      entry.coordinate,
      `rift hunger protectedCells[${index}]`,
      'invalid-level-state',
    );
    assertSafePositiveInteger(
      entry.remainingAcceptedMoves,
      `protectedCells[${index}].remainingAcceptedMoves`,
      'invalid-level-state',
    );
  }

  return cloneRiftHungerState(state);
}

function assertUniqueCoordinates(
  coordinates: readonly BoardCoordinate[],
  label: string,
): Set<string> {
  const seen = new Set<string>();
  for (const coordinate of coordinates) {
    const key = coordinateKey(coordinate);
    if (seen.has(key)) {
      throw new BoardDomainError('invalid-level-state', `duplicate rift hunger ${label} ${key}`);
    }
    seen.add(key);
  }
  return seen;
}

/**
 * Canonical definition/state/board relationship validator.
 * Returns a defensive normalized clone or throws BoardDomainError.
 */
export function validateRiftHungerStateRelationship(input: {
  definition: RiftHungerDefinition;
  state: RiftHungerState;
  boardDimensions: BoardDimensions;
}): RiftHungerState {
  const definition = validateRiftHungerDefinition(input.definition, input.boardDimensions);
  const structural = validateRiftHungerState(input.state);
  const dimensions = input.boardDimensions;

  const sourceKeys = assertUniqueCoordinates(structural.sourceCells, 'sourceCells');
  const corruptedKeys = assertUniqueCoordinates(structural.corruptedCells, 'corruptedCells');
  const protectedCoords = structural.protectedCells.map((entry) => entry.coordinate);
  assertUniqueCoordinates(protectedCoords, 'protectedCells');

  for (const [index, coordinate] of structural.sourceCells.entries()) {
    assertCoordinateInBounds(coordinate, dimensions, `rift hunger state sourceCells[${index}]`);
  }
  for (const [index, coordinate] of structural.corruptedCells.entries()) {
    assertCoordinateInBounds(coordinate, dimensions, `rift hunger state corruptedCells[${index}]`);
  }
  if (structural.threatenedCell) {
    assertCoordinateInBounds(structural.threatenedCell, dimensions, 'rift hunger threatenedCell');
  }
  for (const [index, entry] of structural.protectedCells.entries()) {
    assertCoordinateInBounds(entry.coordinate, dimensions, `rift hunger protectedCells[${index}]`);
  }

  const definitionSourceKeys = new Set(definition.sourceCells.map(coordinateKey));
  if (sourceKeys.size !== definitionSourceKeys.size) {
    throw new BoardDomainError(
      'invalid-level-state',
      'rift hunger state sourceCells must match definition sourceCells',
    );
  }
  for (const key of definitionSourceKeys) {
    if (!sourceKeys.has(key)) {
      throw new BoardDomainError(
        'invalid-level-state',
        `rift hunger state missing definition source cell ${key}`,
      );
    }
  }

  for (const key of sourceKeys) {
    if (!corruptedKeys.has(key)) {
      throw new BoardDomainError(
        'invalid-level-state',
        `rift hunger source cell ${key} must appear in corruptedCells`,
      );
    }
  }

  for (const entry of structural.protectedCells) {
    const key = coordinateKey(entry.coordinate);
    if (corruptedKeys.has(key)) {
      throw new BoardDomainError(
        'invalid-level-state',
        `rift hunger protected cell ${key} overlaps corruption`,
      );
    }
  }

  if (structural.acceptedMovesUntilSpread > definition.spreadInterval) {
    throw new BoardDomainError(
      'invalid-level-state',
      `rift hunger acceptedMovesUntilSpread ${String(structural.acceptedMovesUntilSpread)} exceeds spreadInterval ${String(definition.spreadInterval)}`,
    );
  }

  if (structural.status === 'overwhelmed') {
    if (structural.hungerCurrent < definition.hungerMaximum) {
      throw new BoardDomainError(
        'invalid-level-state',
        'overwhelmed rift hunger requires hungerCurrent >= hungerMaximum',
      );
    }
    if (structural.threatenedCell !== null) {
      throw new BoardDomainError(
        'invalid-level-state',
        'overwhelmed rift hunger must have null threatenedCell',
      );
    }
    if (structural.acceptedMovesUntilSpread !== 0) {
      throw new BoardDomainError(
        'invalid-level-state',
        'overwhelmed rift hunger must have acceptedMovesUntilSpread 0',
      );
    }
  } else {
    if (structural.hungerCurrent >= definition.hungerMaximum) {
      throw new BoardDomainError(
        'invalid-level-state',
        `${structural.status} rift hunger requires hungerCurrent < hungerMaximum`,
      );
    }
  }

  const eligibleFrontier = listEligibleFrontierCells({
    dimensions,
    corruptedCells: structural.corruptedCells,
    protectedCells: structural.protectedCells,
  });
  const eligibleKeys = new Set(eligibleFrontier.map(coordinateKey));
  const uncorruptedFrontier = listUncorruptedOrthogonalFrontier({
    dimensions,
    corruptedCells: structural.corruptedCells,
  });

  if (structural.status === 'active') {
    if (!structural.threatenedCell) {
      throw new BoardDomainError(
        'invalid-level-state',
        'active rift hunger requires a non-null threatenedCell',
      );
    }
    if (
      structural.acceptedMovesUntilSpread < 1 ||
      structural.acceptedMovesUntilSpread > definition.spreadInterval
    ) {
      throw new BoardDomainError(
        'invalid-level-state',
        'active rift hunger requires acceptedMovesUntilSpread in 1..spreadInterval',
      );
    }
    const threatKey = coordinateKey(structural.threatenedCell);
    if (!eligibleKeys.has(threatKey)) {
      throw new BoardDomainError(
        'invalid-level-state',
        `active rift hunger threatenedCell ${threatKey} is not an eligible orthogonal frontier cell`,
      );
    }
  }

  if (structural.status === 'contained') {
    if (structural.threatenedCell !== null) {
      throw new BoardDomainError(
        'invalid-level-state',
        'contained rift hunger must have null threatenedCell',
      );
    }
    if (structural.acceptedMovesUntilSpread !== 0) {
      throw new BoardDomainError(
        'invalid-level-state',
        'contained rift hunger must have acceptedMovesUntilSpread 0',
      );
    }
    if (uncorruptedFrontier.length > 0) {
      throw new BoardDomainError(
        'invalid-level-state',
        'contained rift hunger requires no remaining uncorrupted orthogonal frontier',
      );
    }
  }

  // Normalize clone with sorted arrays for stable downstream use.
  return {
    status: structural.status,
    sourceCells: [...structural.sourceCells].sort(compareCoordinates).map(cloneCoordinate),
    corruptedCells: [...structural.corruptedCells].sort(compareCoordinates).map(cloneCoordinate),
    threatenedCell: structural.threatenedCell ? cloneCoordinate(structural.threatenedCell) : null,
    acceptedMovesUntilSpread: structural.acceptedMovesUntilSpread,
    spreadGeneration: structural.spreadGeneration,
    hungerCurrent: structural.hungerCurrent,
    protectedCells: [...structural.protectedCells]
      .sort((a, b) => compareCoordinates(a.coordinate, b.coordinate))
      .map(cloneProtectedCell),
  };
}
