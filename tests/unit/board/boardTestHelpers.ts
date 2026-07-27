import { Board } from '../../../src/game/board/Board';
import {
  createAreaClearPiece,
  createLineClearPiece,
  createStandardPiece,
  createWildcardPiece,
} from '../../../src/game/board/boardPieces';
import { BoardPiece, PieceType } from '../../../src/game/board/boardTypes';

export function standardPiece(pieceType: PieceType) {
  return createStandardPiece(pieceType);
}

export function standardGrid(grid: readonly (readonly (PieceType | null)[])[]) {
  return grid.map((row) => row.map((cell) => (cell === null ? null : createStandardPiece(cell))));
}

export function standardBoard(grid: readonly (readonly PieceType[])[]): Board {
  return Board.fromPieceTypes(grid);
}

export function lineClearPiece(pieceType: PieceType, orientation: 'horizontal' | 'vertical') {
  return createLineClearPiece(pieceType, orientation);
}

export function wildcardPiece(pieceType: PieceType) {
  return createWildcardPiece(pieceType);
}

export function areaClearPiece(pieceType: PieceType) {
  return createAreaClearPiece(pieceType);
}

export function boardFromPieces(grid: readonly (readonly BoardPiece[])[]): Board {
  return Board.fromGrid(grid);
}
