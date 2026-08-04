import { Board } from './Board';
import { BoardCoordinate, MatchDetectionResult, MatchRun, MatchOrientation } from './boardTypes';
import {
  coordinateKey,
  unavailableCoordinateKeySet,
  validateUnavailableCoordinates,
} from './boardAvailability';
import { getPieceType } from './boardPieces';

function collectRunCoordinates(
  orientation: MatchOrientation,
  fixedIndex: number,
  startIndex: number,
  length: number,
): BoardCoordinate[] {
  const coordinates: BoardCoordinate[] = [];

  for (let offset = 0; offset < length; offset += 1) {
    if (orientation === 'horizontal') {
      coordinates.push({ row: fixedIndex, column: startIndex + offset });
    } else {
      coordinates.push({ row: startIndex + offset, column: fixedIndex });
    }
  }

  return coordinates;
}

export function findMatchRuns(
  board: Board,
  unavailableCoordinates: readonly BoardCoordinate[] = [],
): MatchDetectionResult {
  const { rows, columns } = board.getDimensions();
  const unavailableKeys = unavailableCoordinateKeySet(
    validateUnavailableCoordinates(unavailableCoordinates, { rows, columns }),
  );
  const runs: MatchRun[] = [];

  for (let row = 0; row < rows; row += 1) {
    let runStart = 0;
    while (runStart < columns) {
      if (unavailableKeys.has(coordinateKey({ row, column: runStart }))) {
        runStart += 1;
        continue;
      }

      const pieceType = getPieceType(board.getPieceAt({ row, column: runStart }));
      let runLength = 1;

      while (runStart + runLength < columns) {
        if (unavailableKeys.has(coordinateKey({ row, column: runStart + runLength }))) {
          break;
        }
        const nextPiece = getPieceType(board.getPieceAt({ row, column: runStart + runLength }));
        if (nextPiece !== pieceType) {
          break;
        }
        runLength += 1;
      }

      if (runLength >= 3) {
        runs.push({
          orientation: 'horizontal',
          pieceType,
          coordinates: collectRunCoordinates('horizontal', row, runStart, runLength),
        });
      }

      runStart += runLength;
    }
  }

  for (let column = 0; column < columns; column += 1) {
    let runStart = 0;
    while (runStart < rows) {
      if (unavailableKeys.has(coordinateKey({ row: runStart, column }))) {
        runStart += 1;
        continue;
      }

      const pieceType = getPieceType(board.getPieceAt({ row: runStart, column }));
      let runLength = 1;

      while (runStart + runLength < rows) {
        if (unavailableKeys.has(coordinateKey({ row: runStart + runLength, column }))) {
          break;
        }
        const nextPiece = getPieceType(board.getPieceAt({ row: runStart + runLength, column }));
        if (nextPiece !== pieceType) {
          break;
        }
        runLength += 1;
      }

      if (runLength >= 3) {
        runs.push({
          orientation: 'vertical',
          pieceType,
          coordinates: collectRunCoordinates('vertical', column, runStart, runLength),
        });
      }

      runStart += runLength;
    }
  }

  const coordinateMap = new Map<string, BoardCoordinate>();
  for (const run of runs) {
    for (const coordinate of run.coordinates) {
      coordinateMap.set(coordinateKey(coordinate), coordinate);
    }
  }

  const matchedCoordinates = [...coordinateMap.values()].sort((a, b) => {
    if (a.row !== b.row) {
      return a.row - b.row;
    }
    return a.column - b.column;
  });

  return {
    runs,
    matchedCoordinates,
  };
}
