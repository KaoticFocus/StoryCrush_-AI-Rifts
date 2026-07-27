import { Board } from './Board';
import { BoardPiece, ResolvableCell, ResolvableGrid } from './boardTypes';
import { BoardDomainError } from './errors';
import { cloneBoardPiece, normalizeBoardPiece } from './boardPieces';

export function cloneResolvableGrid(
  grid: readonly (readonly (BoardPiece | null)[])[],
): ResolvableGrid {
  return grid.map((row) => row.map((cell) => (cell === null ? null : cloneBoardPiece(cell))));
}

export function validateResolvableGrid(grid: readonly (readonly (BoardPiece | null)[])[]): {
  rows: number;
  columns: number;
} {
  if (!Array.isArray(grid) || grid.length === 0) {
    throw new BoardDomainError(
      'invalid-resolvable-grid',
      'resolvable grid must contain at least one row',
    );
  }

  const firstRow = grid[0];
  if (!Array.isArray(firstRow) || firstRow.length === 0) {
    throw new BoardDomainError(
      'invalid-resolvable-grid',
      'resolvable grid must contain at least one column',
    );
  }

  const rows = grid.length;
  const columns = firstRow.length;

  for (let row = 0; row < rows; row += 1) {
    const currentRow = grid[row];
    if (!Array.isArray(currentRow) || currentRow.length !== columns) {
      throw new BoardDomainError(
        'invalid-resolvable-grid',
        `row ${row} does not match expected column count ${columns}`,
      );
    }

    for (let column = 0; column < columns; column += 1) {
      const cell = currentRow[column];
      if (cell !== null) {
        normalizeBoardPiece(cell);
      }
      if (cell !== null && typeof cell !== 'object') {
        throw new BoardDomainError(
          'invalid-resolvable-grid',
          `invalid cell value at row=${row}, column=${column}: ${JSON.stringify(cell)}`,
        );
      }
    }
  }

  return { rows, columns };
}

export function boardToResolvableGrid(board: Board): ResolvableGrid {
  return board.toGridSnapshot().map((row) => row.map((cell) => cloneBoardPiece(cell)));
}

export function resolvableGridToBoard(grid: readonly (readonly ResolvableCell[])[]): Board {
  const { rows, columns } = validateResolvableGrid(grid);
  const populatedGrid: BoardPiece[][] = [];

  for (let row = 0; row < rows; row += 1) {
    const nextRow: BoardPiece[] = [];
    for (let column = 0; column < columns; column += 1) {
      const cell = grid[row][column];
      if (cell === null) {
        throw new BoardDomainError(
          'invalid-resolvable-grid',
          `cannot convert grid with empty cell to Board at row=${row}, column=${column}`,
        );
      }
      nextRow.push(cloneBoardPiece(cell));
    }
    populatedGrid.push(nextRow);
  }

  return Board.fromGrid(populatedGrid);
}
