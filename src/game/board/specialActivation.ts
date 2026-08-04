import { Board } from './Board';
import {
  BoardCoordinate,
  SpecialActivationEvent,
  SpecialActivationReason,
  SpecialActivationResult,
  SpecialActivationTrigger,
  SpecialBoardPiece,
  WildcardActivationTarget,
} from './boardTypes';
import { isSpecialPiece, isWildcardPiece } from './boardPieces';
import {
  coordinateKey,
  unavailableCoordinateKeySet,
  validateUnavailableCoordinates,
} from './boardAvailability';
import { BoardDomainError } from './errors';
import { determineWildcardTarget } from './wildcardTargeting';

export const DEFAULT_MAX_SPECIAL_ACTIVATIONS = 256;

interface ResolveSpecialActivationsInput {
  board: Board;
  initialTriggers: readonly SpecialActivationTrigger[];
  unavailableCoordinates?: readonly BoardCoordinate[];
  maxSpecialActivations?: number;
}

interface ActivationQueueItem {
  coordinate: BoardCoordinate;
  reason: SpecialActivationReason;
  wildcardTarget?: WildcardActivationTarget;
}

function compareCoordinates(left: BoardCoordinate, right: BoardCoordinate): number {
  if (left.row !== right.row) {
    return left.row - right.row;
  }

  return left.column - right.column;
}

function cloneCoordinate(coordinate: BoardCoordinate): BoardCoordinate {
  return { row: coordinate.row, column: coordinate.column };
}

function cloneCoordinates(coordinates: readonly BoardCoordinate[]): BoardCoordinate[] {
  return coordinates.map((coordinate) => cloneCoordinate(coordinate));
}

function cloneWildcardTarget(
  target?: WildcardActivationTarget,
): WildcardActivationTarget | undefined {
  return target ? { ...target } : undefined;
}

function cloneSpecialPiece(piece: SpecialBoardPiece): SpecialBoardPiece {
  switch (piece.kind) {
    case 'line-clear':
      return { kind: 'line-clear', pieceType: piece.pieceType, orientation: piece.orientation };
    case 'cross-clear':
      return { kind: 'cross-clear', pieceType: piece.pieceType };
    case 'wildcard':
      return { kind: 'wildcard', pieceType: piece.pieceType };
  }
}

function validateActivationLimit(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new BoardDomainError(
      'invalid-special-activation-limit',
      `maxSpecialActivations must be an integer greater than zero; received ${String(value)}`,
    );
  }

  return value;
}

function reasonPriority(reason: SpecialActivationReason): number {
  switch (reason) {
    case 'direct-swap':
      return 3;
    case 'matched':
      return 2;
    case 'chain-reaction':
      return 1;
  }
}

function sortCoordinates(coordinates: Iterable<BoardCoordinate>): BoardCoordinate[] {
  return [...coordinates].sort(compareCoordinates).map((coordinate) => cloneCoordinate(coordinate));
}

function dedupeCoordinates(coordinates: readonly BoardCoordinate[]): BoardCoordinate[] {
  const keys = new Set<string>();
  const unique: BoardCoordinate[] = [];

  for (const coordinate of coordinates) {
    const key = coordinateKey(coordinate);
    if (!keys.has(key)) {
      keys.add(key);
      unique.push(cloneCoordinate(coordinate));
    }
  }

  return unique.sort(compareCoordinates);
}

function getWildcardAffectedCoordinates(
  board: Board,
  coordinate: BoardCoordinate,
  target: WildcardActivationTarget,
): BoardCoordinate[] {
  const { rows, columns } = board.getDimensions();

  if (target.mode === 'entire-board') {
    const affected: BoardCoordinate[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        affected.push({ row, column });
      }
    }
    return affected;
  }

  if (!target.pieceType) {
    throw new BoardDomainError(
      'invalid-wildcard-target',
      'piece-type wildcard target requires a pieceType',
    );
  }

  const matches: BoardCoordinate[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const entry = board.getPieceAt({ row, column });
      if (entry.pieceType === target.pieceType) {
        matches.push({ row, column });
      }
    }
  }

  matches.push(cloneCoordinate(coordinate));
  return dedupeCoordinates(matches);
}

export function getSpecialActivationEffect(input: {
  board: Board;
  coordinate: BoardCoordinate;
  wildcardTarget?: WildcardActivationTarget;
}): BoardCoordinate[] {
  const { board, coordinate } = input;
  if (!board.isWithinBounds(coordinate)) {
    throw new BoardDomainError(
      'invalid-special-activation-trigger',
      `activation coordinate is out of bounds: row=${coordinate.row}, column=${coordinate.column}`,
    );
  }

  const piece = board.getPieceAt(coordinate);
  if (!isSpecialPiece(piece)) {
    throw new BoardDomainError(
      'invalid-special-activation-trigger',
      'activation coordinate does not contain a special piece',
    );
  }

  const { rows, columns } = board.getDimensions();

  if (piece.kind === 'line-clear') {
    const affected: BoardCoordinate[] = [];

    if (piece.orientation === 'horizontal') {
      for (let column = 0; column < columns; column += 1) {
        affected.push({ row: coordinate.row, column });
      }
      return affected;
    }

    for (let row = 0; row < rows; row += 1) {
      affected.push({ row, column: coordinate.column });
    }
    return affected;
  }

  if (piece.kind === 'cross-clear') {
    // Full row + full column; center counted once. Row L→R, then column T→B.
    const affected: BoardCoordinate[] = [];
    for (let column = 0; column < columns; column += 1) {
      affected.push({ row: coordinate.row, column });
    }
    for (let row = 0; row < rows; row += 1) {
      if (row === coordinate.row) {
        continue;
      }
      affected.push({ row, column: coordinate.column });
    }
    return affected;
  }

  const wildcardTarget =
    input.wildcardTarget ?? determineWildcardTarget({ wildcardPiece: piece, reason: 'matched' });
  return getWildcardAffectedCoordinates(board, coordinate, wildcardTarget);
}

export function resolveSpecialActivations(
  input: ResolveSpecialActivationsInput,
): SpecialActivationResult {
  const maxSpecialActivations = validateActivationLimit(
    input.maxSpecialActivations ?? DEFAULT_MAX_SPECIAL_ACTIVATIONS,
  );

  const queue: ActivationQueueItem[] = [];
  const queueIndex = new Map<string, number>();
  const activatedKeys = new Set<string>();
  const events: SpecialActivationEvent[] = [];
  const totalAffectedMap = new Map<string, BoardCoordinate>();
  const unavailableKeys = unavailableCoordinateKeySet(
    validateUnavailableCoordinates(input.unavailableCoordinates ?? [], input.board.getDimensions()),
  );

  const enqueue = (item: ActivationQueueItem): void => {
    const key = coordinateKey(item.coordinate);
    if (!input.board.isWithinBounds(item.coordinate)) {
      throw new BoardDomainError(
        'invalid-special-activation-trigger',
        `trigger coordinate is out of bounds: row=${item.coordinate.row}, column=${item.coordinate.column}`,
      );
    }

    if (unavailableKeys.has(key)) {
      return;
    }

    const boardPiece = input.board.getPieceAt(item.coordinate);
    if (!isSpecialPiece(boardPiece)) {
      throw new BoardDomainError(
        'invalid-special-activation-trigger',
        'trigger coordinate does not contain a special piece',
      );
    }

    const existingIndex = queueIndex.get(key);
    if (existingIndex === undefined) {
      queueIndex.set(key, queue.length);
      queue.push({
        coordinate: cloneCoordinate(item.coordinate),
        reason: item.reason,
        wildcardTarget: cloneWildcardTarget(item.wildcardTarget),
      });
      return;
    }

    const existing = queue[existingIndex];
    if (reasonPriority(item.reason) > reasonPriority(existing.reason)) {
      existing.reason = item.reason;
      if (item.wildcardTarget) {
        existing.wildcardTarget = cloneWildcardTarget(item.wildcardTarget);
      }
    }

    if (
      existing.reason === 'direct-swap' &&
      item.reason === 'direct-swap' &&
      JSON.stringify(existing.wildcardTarget ?? null) !==
        JSON.stringify(item.wildcardTarget ?? null)
    ) {
      throw new BoardDomainError(
        'invalid-special-activation-trigger',
        `conflicting direct-swap trigger target at ${key}`,
      );
    }
  };

  for (const trigger of input.initialTriggers) {
    enqueue({
      coordinate: trigger.coordinate,
      reason: trigger.reason,
      wildcardTarget: trigger.wildcardTarget,
    });
  }

  for (let pointer = 0; pointer < queue.length; pointer += 1) {
    if (events.length >= maxSpecialActivations) {
      throw new BoardDomainError(
        'special-activation-limit-exceeded',
        `special activation count exceeded maxSpecialActivations=${maxSpecialActivations}`,
      );
    }

    const next = queue[pointer];
    const key = coordinateKey(next.coordinate);
    if (activatedKeys.has(key)) {
      continue;
    }

    const boardPiece = input.board.getPieceAt(next.coordinate);
    if (!isSpecialPiece(boardPiece)) {
      throw new BoardDomainError(
        'invalid-special-activation-trigger',
        'queued coordinate no longer contains a special piece',
      );
    }

    let wildcardTarget = cloneWildcardTarget(next.wildcardTarget);
    if (isWildcardPiece(boardPiece) && !wildcardTarget) {
      wildcardTarget = determineWildcardTarget({ wildcardPiece: boardPiece, reason: next.reason });
    }

    const affectedCoordinates = getSpecialActivationEffect({
      board: input.board,
      coordinate: next.coordinate,
      wildcardTarget,
    });

    const newlyTriggeredSpecialCoordinates: BoardCoordinate[] = [];
    const chainCandidates: BoardCoordinate[] = [];

    for (const coordinate of affectedCoordinates) {
      totalAffectedMap.set(coordinateKey(coordinate), cloneCoordinate(coordinate));

      if (unavailableKeys.has(coordinateKey(coordinate))) {
        continue;
      }

      const piece = input.board.getPieceAt(coordinate);
      if (!isSpecialPiece(piece)) {
        continue;
      }

      const specialKey = coordinateKey(coordinate);
      if (activatedKeys.has(specialKey) || queueIndex.has(specialKey)) {
        continue;
      }

      chainCandidates.push(cloneCoordinate(coordinate));
    }

    const sortedChainCandidates = sortCoordinates(chainCandidates);
    for (const coordinate of sortedChainCandidates) {
      enqueue({ coordinate, reason: 'chain-reaction' });
      newlyTriggeredSpecialCoordinates.push(cloneCoordinate(coordinate));
    }

    activatedKeys.add(key);
    events.push({
      index: events.length,
      coordinate: cloneCoordinate(next.coordinate),
      piece: cloneSpecialPiece(boardPiece),
      reason: next.reason,
      wildcardTarget: cloneWildcardTarget(wildcardTarget),
      affectedCoordinates: cloneCoordinates(affectedCoordinates),
      newlyTriggeredSpecialCoordinates: cloneCoordinates(newlyTriggeredSpecialCoordinates),
    });
  }

  return {
    events: events.map((event) => ({
      index: event.index,
      coordinate: cloneCoordinate(event.coordinate),
      piece: cloneSpecialPiece(event.piece),
      reason: event.reason,
      wildcardTarget: cloneWildcardTarget(event.wildcardTarget),
      affectedCoordinates: cloneCoordinates(event.affectedCoordinates),
      newlyTriggeredSpecialCoordinates: cloneCoordinates(event.newlyTriggeredSpecialCoordinates),
    })),
    affectedCoordinates: sortCoordinates(totalAffectedMap.values()),
  };
}
