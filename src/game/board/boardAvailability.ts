import { BoardCoordinate, BoardDimensions } from './boardTypes';
import { BoardDomainError } from './errors';

export interface BoardAvailability {
  unavailableCoordinates: readonly BoardCoordinate[];
}

export function coordinateKey(coordinate: BoardCoordinate): string {
  return `${coordinate.row},${coordinate.column}`;
}

function compareCoordinates(left: BoardCoordinate, right: BoardCoordinate): number {
  if (left.row !== right.row) {
    return left.row - right.row;
  }

  return left.column - right.column;
}

export function validateUnavailableCoordinates(
  coordinates: readonly BoardCoordinate[],
  boardDimensions: BoardDimensions,
): BoardCoordinate[] {
  if (!Array.isArray(coordinates)) {
    throw new BoardDomainError(
      'invalid-unavailable-coordinates',
      'unavailableCoordinates must be an array',
    );
  }

  const seen = new Set<string>();
  const normalized: BoardCoordinate[] = [];

  for (const coordinate of coordinates) {
    if (
      coordinate === null ||
      typeof coordinate !== 'object' ||
      !Number.isSafeInteger(coordinate.row) ||
      !Number.isSafeInteger(coordinate.column) ||
      coordinate.row < 0 ||
      coordinate.column < 0
    ) {
      throw new BoardDomainError(
        'invalid-unavailable-coordinates',
        'unavailable coordinates must contain non-negative safe integer row and column values',
      );
    }

    if (coordinate.row >= boardDimensions.rows || coordinate.column >= boardDimensions.columns) {
      throw new BoardDomainError(
        'invalid-unavailable-coordinates',
        `unavailable coordinate is out of bounds: row=${coordinate.row}, column=${coordinate.column}`,
      );
    }

    const key = coordinateKey(coordinate);
    if (seen.has(key)) {
      throw new BoardDomainError(
        'invalid-unavailable-coordinates',
        `duplicate unavailable coordinate: row=${coordinate.row}, column=${coordinate.column}`,
      );
    }

    seen.add(key);
    normalized.push({ row: coordinate.row, column: coordinate.column });
  }

  return normalized.sort(compareCoordinates);
}

export function unavailableCoordinateKeySet(coordinates: readonly BoardCoordinate[]): Set<string> {
  return new Set(coordinates.map((coordinate) => coordinateKey(coordinate)));
}
