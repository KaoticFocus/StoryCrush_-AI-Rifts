import { Board } from './Board';
import { BoardCoordinate, MatchDetectionResult, MatchRun, MatchOrientation } from './boardTypes';
import { getPieceType } from './boardPieces';

function coordinateKey(coordinate: BoardCoordinate): string {
  return `${coordinate.row},${coordinate.column}`;
}

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

export function findMatchRuns(board: Board): MatchDetectionResult {
  const { rows, columns } = board.getDimensions();
  const runs: MatchRun[] = [];

  for (let row = 0; row < rows; row += 1) {
    let runStart = 0;
    while (runStart < columns) {
      const pieceType = getPieceType(board.getPieceAt({ row, column: runStart }));
      let runLength = 1;

      while (runStart + runLength < columns) {
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
      const pieceType = getPieceType(board.getPieceAt({ row: runStart, column }));
      let runLength = 1;

      while (runStart + runLength < rows) {
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
