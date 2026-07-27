import { BoardCoordinate, CascadeStep } from '../board/boardTypes';
import { cloneBoardPiece, getPieceType } from '../board/boardPieces';
import { PieceCollectionEvent } from './levelTypes';

function compareCoordinates(left: BoardCoordinate, right: BoardCoordinate): number {
  if (left.row !== right.row) {
    return left.row - right.row;
  }

  return left.column - right.column;
}

function uniqueSortedCoordinates(coordinates: readonly BoardCoordinate[]): BoardCoordinate[] {
  const map = new Map<string, BoardCoordinate>();
  for (const coordinate of coordinates) {
    map.set(`${coordinate.row},${coordinate.column}`, {
      row: coordinate.row,
      column: coordinate.column,
    });
  }

  return [...map.values()].sort(compareCoordinates);
}

export function createPieceCollectionEvents(input: {
  resolution: { isValid: true; steps: CascadeStep[] };
}): PieceCollectionEvent[] {
  const events: PieceCollectionEvent[] = [];

  for (const step of input.resolution.steps) {
    const coordinates = uniqueSortedCoordinates(step.actualRemovedCoordinates);

    for (const coordinate of coordinates) {
      const piece = step.boardBeforeRemoval.getPieceAt(coordinate);
      events.push({
        stepIndex: step.index,
        coordinate: {
          row: coordinate.row,
          column: coordinate.column,
        },
        piece: cloneBoardPiece(piece),
        pieceType: getPieceType(piece),
      });
    }
  }

  return events;
}
