import { Board } from './Board';
import { BoardPiece, ExactPieceInventory, MatchOrientation, PieceType } from './boardTypes';
import {
  cloneBoardPiece,
  createAreaClearPiece,
  createLineClearPiece,
  createStandardPiece,
  createWildcardPiece,
} from './boardPieces';
import { BoardDomainError } from './errors';

const pieceTypes: readonly PieceType[] = [
  'ruby',
  'sapphire',
  'emerald',
  'topaz',
  'amethyst',
  'pearl',
];
const orientations: readonly MatchOrientation[] = ['horizontal', 'vertical'];

export function getPieceInventoryKey(piece: BoardPiece): string {
  switch (piece.kind) {
    case 'standard':
      return `standard:${piece.pieceType}`;
    case 'line-clear':
      return `line-clear:${piece.pieceType}:${piece.orientation}`;
    case 'wildcard':
      return `wildcard:${piece.pieceType}`;
    case 'area-clear':
      return `area-clear:${piece.pieceType}`;
  }
}

export function createEmptyPieceInventory(): ExactPieceInventory {
  const inventory: ExactPieceInventory = {};

  for (const pieceType of pieceTypes) {
    inventory[`standard:${pieceType}`] = 0;
  }

  for (const pieceType of pieceTypes) {
    for (const orientation of orientations) {
      inventory[`line-clear:${pieceType}:${orientation}`] = 0;
    }
  }

  for (const pieceType of pieceTypes) {
    inventory[`wildcard:${pieceType}`] = 0;
  }

  for (const pieceType of pieceTypes) {
    inventory[`area-clear:${pieceType}`] = 0;
  }

  return inventory;
}

export function createPieceInventory(board: Board): ExactPieceInventory {
  const inventory = createEmptyPieceInventory();

  const snapshot = board.toGridSnapshot();
  for (const row of snapshot) {
    for (const piece of row) {
      const key = getPieceInventoryKey(cloneBoardPiece(piece));
      inventory[key] += 1;
    }
  }

  return inventory;
}

export function inventoryTotal(inventory: ExactPieceInventory): number {
  return Object.values(inventory).reduce((total, count) => total + count, 0);
}

export function parsePieceInventoryKey(key: string): BoardPiece {
  const [kind, pieceType, orientation] = key.split(':');

  switch (kind) {
    case 'standard':
      return createStandardPiece(assertPieceType(pieceType));
    case 'line-clear':
      if (orientation !== 'horizontal' && orientation !== 'vertical') {
        throw new BoardDomainError(
          'invalid-board-piece',
          `invalid line-clear inventory key: ${key}`,
        );
      }
      return createLineClearPiece(assertPieceType(pieceType), orientation);
    case 'wildcard':
      return createWildcardPiece(assertPieceType(pieceType));
    case 'area-clear':
      return createAreaClearPiece(assertPieceType(pieceType));
    default:
      throw new BoardDomainError('invalid-board-piece', `invalid inventory key: ${key}`);
  }
}

function assertPieceType(value: string | undefined): PieceType {
  if (
    value !== 'ruby' &&
    value !== 'sapphire' &&
    value !== 'emerald' &&
    value !== 'topaz' &&
    value !== 'amethyst' &&
    value !== 'pearl'
  ) {
    throw new BoardDomainError(
      'invalid-board-piece',
      `invalid piece type in inventory key: ${String(value)}`,
    );
  }

  return value;
}
