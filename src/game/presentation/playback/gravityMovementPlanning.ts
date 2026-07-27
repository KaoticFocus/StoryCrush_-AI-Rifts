import { BoardDomainError, type BoardCoordinate, type ResolvableGrid } from '../../board';
import { cloneBoardPiece } from '../../board/boardPieces';
import { cloneResolvableGrid, validateResolvableGrid } from '../../board/resolutionGrid';
import { type GravityMovement } from './playbackTypes';

interface PopulatedEntry {
  coordinate: BoardCoordinate;
  piece: NonNullable<ResolvableGrid[number][number]>;
}

function cloneCoordinate(coordinate: BoardCoordinate): BoardCoordinate {
  return { row: coordinate.row, column: coordinate.column };
}

function getPopulatedEntries(grid: ResolvableGrid, column: number): PopulatedEntry[] {
  const entries: PopulatedEntry[] = [];

  for (let row = grid.length - 1; row >= 0; row -= 1) {
    const cell = grid[row][column];
    if (cell !== null) {
      entries.push({
        coordinate: { row, column },
        piece: cell,
      });
    }
  }

  return entries;
}

export function planGravityMovements(input: {
  gridBeforeGravity: ResolvableGrid;
  gridAfterGravity: ResolvableGrid;
}): GravityMovement[] {
  const gridBeforeGravity = cloneResolvableGrid(input.gridBeforeGravity);
  const gridAfterGravity = cloneResolvableGrid(input.gridAfterGravity);
  const beforeDimensions = validateResolvableGrid(gridBeforeGravity);
  const afterDimensions = validateResolvableGrid(gridAfterGravity);

  if (
    beforeDimensions.rows !== afterDimensions.rows ||
    beforeDimensions.columns !== afterDimensions.columns
  ) {
    throw new BoardDomainError(
      'invalid-resolvable-grid',
      'gravity planning requires matching source and destination grid dimensions',
    );
  }

  const movements: GravityMovement[] = [];

  for (let column = 0; column < beforeDimensions.columns; column += 1) {
    const sourceEntries = getPopulatedEntries(gridBeforeGravity, column);
    const destinationEntries = getPopulatedEntries(gridAfterGravity, column);

    if (sourceEntries.length !== destinationEntries.length) {
      throw new BoardDomainError(
        'invalid-resolvable-grid',
        `gravity planning requires matching populated counts for column ${column}`,
      );
    }

    for (let index = 0; index < sourceEntries.length; index += 1) {
      const source = sourceEntries[index];
      const destination = destinationEntries[index];

      if (source.coordinate.row < destination.coordinate.row) {
        movements.push({
          from: cloneCoordinate(source.coordinate),
          to: cloneCoordinate(destination.coordinate),
          piece: cloneBoardPiece(source.piece),
          distance: destination.coordinate.row - source.coordinate.row,
        });
      }
    }
  }

  return movements;
}
