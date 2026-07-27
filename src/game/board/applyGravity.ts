import { BoardPiece, ResolvableCell, ResolvableGrid } from './boardTypes';
import { cloneResolvableGrid, validateResolvableGrid } from './resolutionGrid';

export function applyGravity(grid: readonly (readonly (BoardPiece | null)[])[]): ResolvableGrid {
  const snapshot = cloneResolvableGrid(grid);
  const { rows, columns } = validateResolvableGrid(snapshot);

  const result: ResolvableGrid = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => null),
  );

  for (let column = 0; column < columns; column += 1) {
    const nonEmptyCells: Exclude<ResolvableCell, null>[] = [];

    for (let row = 0; row < rows; row += 1) {
      const cell = snapshot[row][column];
      if (cell !== null) {
        nonEmptyCells.push(cell);
      }
    }

    let writeRow = rows - 1;
    for (let index = nonEmptyCells.length - 1; index >= 0; index -= 1) {
      result[writeRow][column] = nonEmptyCells[index];
      writeRow -= 1;
    }
  }

  return result;
}
