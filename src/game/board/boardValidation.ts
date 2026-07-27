import { BoardDomainError } from './errors';
import { BoardCoordinate, BoardDimensions, DEFAULT_PIECE_TYPES, PieceType } from './boardTypes';

const pieceTypeSet = new Set<string>(DEFAULT_PIECE_TYPES);

export function validateBoardDimensions(dimensions: BoardDimensions): BoardDimensions {
  const { rows, columns } = dimensions;

  if (!Number.isInteger(rows) || rows <= 0) {
    throw new BoardDomainError(
      'invalid-board-dimensions',
      `rows must be an integer greater than zero; received ${String(rows)}`,
    );
  }

  if (!Number.isInteger(columns) || columns <= 0) {
    throw new BoardDomainError(
      'invalid-board-dimensions',
      `columns must be an integer greater than zero; received ${String(columns)}`,
    );
  }

  return { rows, columns };
}

export function isPieceType(value: string): value is PieceType {
  return pieceTypeSet.has(value);
}

export function validateAllowedPieceTypes(pieceTypes: readonly string[]): PieceType[] {
  if (pieceTypes.length === 0) {
    throw new BoardDomainError(
      'empty-piece-types',
      'pieceTypes must contain at least one piece type',
    );
  }

  const uniquePieceTypes: PieceType[] = [];
  const seen = new Set<string>();

  for (const value of pieceTypes) {
    if (!isPieceType(value)) {
      throw new BoardDomainError(
        'invalid-piece-type',
        `pieceTypes contains unsupported value ${JSON.stringify(value)}`,
      );
    }

    if (!seen.has(value)) {
      seen.add(value);
      uniquePieceTypes.push(value);
    }
  }

  return uniquePieceTypes;
}

export function assertCoordinateInBounds(
  coordinate: BoardCoordinate,
  dimensions: BoardDimensions,
  label: string,
): void {
  const { row, column } = coordinate;
  const { rows, columns } = dimensions;

  if (!Number.isInteger(row) || !Number.isInteger(column)) {
    throw new BoardDomainError(
      'coordinate-out-of-bounds',
      `${label} must use integer row/column values; received row=${String(row)}, column=${String(column)}`,
    );
  }

  if (row < 0 || row >= rows || column < 0 || column >= columns) {
    throw new BoardDomainError(
      'coordinate-out-of-bounds',
      `${label} is out of bounds for ${rows}x${columns} board: row=${row}, column=${column}`,
    );
  }
}
