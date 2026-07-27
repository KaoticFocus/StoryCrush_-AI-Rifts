import { Board } from './Board';
import { BoardCoordinate, BoardPiece, ResolvableGrid } from './boardTypes';
import { BoardDomainError } from './errors';
import {
  boardToResolvableGrid,
  cloneResolvableGrid,
  validateResolvableGrid,
} from './resolutionGrid';

function coordinateKey(coordinate: BoardCoordinate): string {
  return `${coordinate.row},${coordinate.column}`;
}

export function removeMatchedCoordinates(
  source: Board | readonly (readonly (BoardPiece | null)[])[],
  coordinates: readonly BoardCoordinate[],
): ResolvableGrid {
  const grid =
    source instanceof Board ? boardToResolvableGrid(source) : cloneResolvableGrid(source);
  const { rows, columns } = validateResolvableGrid(grid);

  const uniqueCoordinates = new Map<string, BoardCoordinate>();
  for (const coordinate of coordinates) {
    uniqueCoordinates.set(coordinateKey(coordinate), coordinate);
  }

  for (const coordinate of uniqueCoordinates.values()) {
    const { row, column } = coordinate;
    if (!Number.isInteger(row) || !Number.isInteger(column)) {
      throw new BoardDomainError(
        'coordinate-out-of-bounds',
        `removal coordinate must be integer row/column values; received row=${String(row)}, column=${String(column)}`,
      );
    }

    if (row < 0 || row >= rows || column < 0 || column >= columns) {
      throw new BoardDomainError(
        'coordinate-out-of-bounds',
        `removal coordinate is out of bounds for ${rows}x${columns} grid: row=${row}, column=${column}`,
      );
    }

    grid[row][column] = null;
  }

  return cloneResolvableGrid(grid);
}
