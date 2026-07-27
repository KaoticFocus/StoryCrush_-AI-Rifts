import { MatchOrientation, PieceType, SpecialPieceCreationPlan } from './boardTypes';
import {
  AreaClearBoardPiece,
  BoardPiece,
  LineClearBoardPiece,
  SpecialBoardPiece,
  StandardBoardPiece,
  WildcardBoardPiece,
} from './boardTypes';
import { BoardDomainError } from './errors';
import { DEFAULT_PIECE_TYPES } from './boardTypes';

const pieceTypeSet = new Set<PieceType>(DEFAULT_PIECE_TYPES);
const pieceKinds = new Set(['standard', 'line-clear', 'wildcard', 'area-clear'] as const);
const orientationSet = new Set<MatchOrientation>(['horizontal', 'vertical']);

function assertValidPieceType(pieceType: string): asserts pieceType is PieceType {
  if (!pieceTypeSet.has(pieceType as PieceType)) {
    throw new BoardDomainError(
      'invalid-board-piece',
      `unsupported piece type: ${JSON.stringify(pieceType)}`,
    );
  }
}

function assertObject(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BoardDomainError('invalid-board-piece', 'board piece must be a non-null object');
  }
}

function assertExactKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): void {
  const keys = Object.keys(value);
  for (const key of keys) {
    if (!allowedKeys.includes(key)) {
      throw new BoardDomainError(
        'invalid-board-piece',
        `board piece contains unexpected property ${JSON.stringify(key)}`,
      );
    }
  }
}

function assertOrientation(value: unknown): asserts value is MatchOrientation {
  if (typeof value !== 'string' || !orientationSet.has(value as MatchOrientation)) {
    throw new BoardDomainError(
      'invalid-special-piece',
      `invalid line-clear orientation: ${JSON.stringify(value)}`,
    );
  }
}

export function createStandardPiece(pieceType: PieceType): StandardBoardPiece {
  assertValidPieceType(pieceType);
  return { kind: 'standard', pieceType };
}

export function createLineClearPiece(
  pieceType: PieceType,
  orientation: MatchOrientation,
): LineClearBoardPiece {
  assertValidPieceType(pieceType);
  assertOrientation(orientation);
  return { kind: 'line-clear', pieceType, orientation };
}

export function createWildcardPiece(pieceType: PieceType): WildcardBoardPiece {
  assertValidPieceType(pieceType);
  return { kind: 'wildcard', pieceType };
}

export function createAreaClearPiece(pieceType: PieceType): AreaClearBoardPiece {
  assertValidPieceType(pieceType);
  return { kind: 'area-clear', pieceType };
}

export function isStandardPiece(piece: BoardPiece): piece is StandardBoardPiece {
  return piece.kind === 'standard';
}

export function isLineClearPiece(piece: BoardPiece): piece is LineClearBoardPiece {
  return piece.kind === 'line-clear';
}

export function isWildcardPiece(piece: BoardPiece): piece is WildcardBoardPiece {
  return piece.kind === 'wildcard';
}

export function isAreaClearPiece(piece: BoardPiece): piece is AreaClearBoardPiece {
  return piece.kind === 'area-clear';
}

export function isSpecialPiece(piece: BoardPiece): piece is SpecialBoardPiece {
  return piece.kind !== 'standard';
}

export function getPieceType(piece: BoardPiece): PieceType {
  return piece.pieceType;
}

function assertValidBoardPiece(value: unknown): asserts value is BoardPiece {
  assertObject(value);
  const kind = value.kind;
  if (typeof kind !== 'string' || !pieceKinds.has(kind as BoardPiece['kind'])) {
    throw new BoardDomainError(
      'invalid-board-piece',
      `invalid board piece kind: ${JSON.stringify(kind)}`,
    );
  }

  if (kind === 'standard') {
    assertExactKeys(value, ['kind', 'pieceType']);
  } else if (kind === 'line-clear') {
    assertExactKeys(value, ['kind', 'pieceType', 'orientation']);
  } else {
    assertExactKeys(value, ['kind', 'pieceType']);
  }

  const pieceType = value.pieceType;
  if (typeof pieceType !== 'string') {
    throw new BoardDomainError('invalid-board-piece', 'board piece is missing a pieceType');
  }
  assertValidPieceType(pieceType);

  if (kind === 'standard') {
    return;
  }

  if (kind === 'line-clear') {
    assertOrientation(value.orientation);
    return;
  }

  if (kind === 'wildcard' || kind === 'area-clear') {
    return;
  }

  throw new BoardDomainError(
    'invalid-board-piece',
    `unsupported board piece kind: ${String(kind)}`,
  );
}

export function cloneBoardPiece(piece: BoardPiece): BoardPiece {
  switch (piece.kind) {
    case 'standard':
      return { kind: 'standard', pieceType: piece.pieceType };
    case 'line-clear':
      return { kind: 'line-clear', pieceType: piece.pieceType, orientation: piece.orientation };
    case 'wildcard':
      return { kind: 'wildcard', pieceType: piece.pieceType };
    case 'area-clear':
      return { kind: 'area-clear', pieceType: piece.pieceType };
  }
}

export function normalizeBoardPiece(value: unknown): BoardPiece {
  assertValidBoardPiece(value);
  return cloneBoardPiece(value);
}

export function createBoardPieceFromPlan(plan: SpecialPieceCreationPlan): SpecialBoardPiece {
  const specialPiece = plan.specialPiece;
  if (!specialPiece) {
    throw new BoardDomainError(
      'invalid-special-piece',
      'special piece plan is missing special piece data',
    );
  }

  switch (specialPiece.kind) {
    case 'line-clear':
      if (!specialPiece.orientation) {
        throw new BoardDomainError(
          'invalid-special-piece',
          'line-clear special pieces require an orientation',
        );
      }
      return createLineClearPiece(plan.sourcePieceType, specialPiece.orientation);
    case 'wildcard':
      return createWildcardPiece(plan.sourcePieceType);
    case 'area-clear':
      return createAreaClearPiece(plan.sourcePieceType);
    default:
      throw new BoardDomainError(
        'invalid-special-piece',
        `unsupported special piece kind: ${JSON.stringify((specialPiece as { kind?: unknown }).kind)}`,
      );
  }
}

export function createBoardPieceFromValue(value: unknown): BoardPiece {
  return normalizeBoardPiece(value);
}
