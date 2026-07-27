import {
  BoardCoordinate,
  ClassifiedMatchGroup,
  MatchDetectionResult,
  MatchGroup,
  MatchOrientation,
  MatchRun,
  MatchShape,
} from './boardTypes';
import { BoardDomainError } from './errors';

function coordinateKey(coordinate: BoardCoordinate): string {
  return `${coordinate.row},${coordinate.column}`;
}

function compareCoordinates(left: BoardCoordinate, right: BoardCoordinate): number {
  if (left.row !== right.row) {
    return left.row - right.row;
  }

  return left.column - right.column;
}

function compareRuns(left: MatchRun, right: MatchRun): number {
  if (left.orientation !== right.orientation) {
    return left.orientation === 'horizontal' ? -1 : 1;
  }

  const leftStart = left.coordinates[0];
  const rightStart = right.coordinates[0];
  const byStart = compareCoordinates(leftStart, rightStart);
  if (byStart !== 0) {
    return byStart;
  }

  return left.coordinates.length - right.coordinates.length;
}

function validateAndCloneRun(run: MatchRun): MatchRun {
  if (!run.coordinates.length) {
    throw new BoardDomainError(
      'invalid-match-run',
      'match run must contain at least one coordinate',
    );
  }

  const clonedCoordinates = run.coordinates.map((coordinate) => ({
    row: coordinate.row,
    column: coordinate.column,
  }));
  clonedCoordinates.sort(compareCoordinates);

  const unique = new Set(clonedCoordinates.map(coordinateKey));
  if (unique.size !== clonedCoordinates.length) {
    throw new BoardDomainError(
      'invalid-match-run',
      'match run cannot contain duplicate coordinates',
    );
  }

  if (run.orientation === 'horizontal') {
    const expectedRow = clonedCoordinates[0].row;
    for (let index = 0; index < clonedCoordinates.length; index += 1) {
      const coordinate = clonedCoordinates[index];
      if (coordinate.row !== expectedRow) {
        throw new BoardDomainError(
          'invalid-match-run',
          'horizontal run must remain on a single row',
        );
      }
      if (coordinate.column !== clonedCoordinates[0].column + index) {
        throw new BoardDomainError(
          'invalid-match-run',
          'horizontal run coordinates must be contiguous',
        );
      }
    }
  } else {
    const expectedColumn = clonedCoordinates[0].column;
    for (let index = 0; index < clonedCoordinates.length; index += 1) {
      const coordinate = clonedCoordinates[index];
      if (coordinate.column !== expectedColumn) {
        throw new BoardDomainError(
          'invalid-match-run',
          'vertical run must remain on a single column',
        );
      }
      if (coordinate.row !== clonedCoordinates[0].row + index) {
        throw new BoardDomainError(
          'invalid-match-run',
          'vertical run coordinates must be contiguous',
        );
      }
    }
  }

  if (clonedCoordinates.length < 3) {
    throw new BoardDomainError('invalid-match-run', 'match run must be at least length 3');
  }

  return {
    orientation: run.orientation,
    pieceType: run.pieceType,
    coordinates: clonedCoordinates,
  };
}

function overlaps(left: MatchRun, right: MatchRun): boolean {
  const leftKeys = new Set(left.coordinates.map(coordinateKey));
  return right.coordinates.some((coordinate) => leftKeys.has(coordinateKey(coordinate)));
}

function computeBounds(coordinates: readonly BoardCoordinate[]) {
  let minRow = Number.POSITIVE_INFINITY;
  let minColumn = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  let maxColumn = Number.NEGATIVE_INFINITY;

  for (const coordinate of coordinates) {
    minRow = Math.min(minRow, coordinate.row);
    minColumn = Math.min(minColumn, coordinate.column);
    maxRow = Math.max(maxRow, coordinate.row);
    maxColumn = Math.max(maxColumn, coordinate.column);
  }

  return { minRow, minColumn, maxRow, maxColumn };
}

export function groupMatchRuns(matches: MatchDetectionResult): MatchGroup[] {
  const runs = matches.runs.map(validateAndCloneRun);
  const parent = runs.map((_, index) => index);

  const find = (index: number): number => {
    if (parent[index] !== index) {
      parent[index] = find(parent[index]);
    }
    return parent[index];
  };

  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parent[rightRoot] = leftRoot;
    }
  };

  for (let leftIndex = 0; leftIndex < runs.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < runs.length; rightIndex += 1) {
      const left = runs[leftIndex];
      const right = runs[rightIndex];
      if (left.pieceType === right.pieceType && overlaps(left, right)) {
        union(leftIndex, rightIndex);
      }
    }
  }

  const componentMap = new Map<number, MatchRun[]>();
  for (let index = 0; index < runs.length; index += 1) {
    const root = find(index);
    const groupRuns = componentMap.get(root) ?? [];
    groupRuns.push(runs[index]);
    componentMap.set(root, groupRuns);
  }

  const groups: MatchGroup[] = [];
  for (const componentRuns of componentMap.values()) {
    const pieceType = componentRuns[0].pieceType;
    for (const run of componentRuns) {
      if (run.pieceType !== pieceType) {
        throw new BoardDomainError(
          'invalid-match-group',
          'match group must use a single piece type',
        );
      }
    }

    const coordinateMap = new Map<string, BoardCoordinate>();
    for (const run of componentRuns) {
      for (const coordinate of run.coordinates) {
        coordinateMap.set(coordinateKey(coordinate), {
          row: coordinate.row,
          column: coordinate.column,
        });
      }
    }

    const coordinates = [...coordinateMap.values()].sort(compareCoordinates);
    const bounds = computeBounds(coordinates);
    const sortedRuns = [...componentRuns].sort(compareRuns).map((run) => ({
      orientation: run.orientation,
      pieceType: run.pieceType,
      coordinates: run.coordinates.map((coordinate) => ({
        row: coordinate.row,
        column: coordinate.column,
      })),
    }));

    groups.push({
      pieceType,
      runs: sortedRuns,
      coordinates,
      bounds,
    });
  }

  groups.sort((left, right) => {
    if (left.bounds.minRow !== right.bounds.minRow) {
      return left.bounds.minRow - right.bounds.minRow;
    }
    if (left.bounds.minColumn !== right.bounds.minColumn) {
      return left.bounds.minColumn - right.bounds.minColumn;
    }
    return left.pieceType.localeCompare(right.pieceType);
  });

  return groups.map((group) => ({
    pieceType: group.pieceType,
    runs: group.runs.map((run) => ({
      orientation: run.orientation,
      pieceType: run.pieceType,
      coordinates: run.coordinates.map((coordinate) => ({ ...coordinate })),
    })),
    coordinates: group.coordinates.map((coordinate) => ({ ...coordinate })),
    bounds: { ...group.bounds },
  }));
}

export function findMatchGroupPivots(group: MatchGroup): BoardCoordinate[] {
  const pivotMap = new Map<string, BoardCoordinate>();
  const horizontalCoords = new Set<string>();
  const verticalCoords = new Set<string>();

  for (const run of group.runs) {
    for (const coordinate of run.coordinates) {
      const key = coordinateKey(coordinate);
      if (run.orientation === 'horizontal') {
        horizontalCoords.add(key);
      } else {
        verticalCoords.add(key);
      }
    }
  }

  for (const coordinate of group.coordinates) {
    const key = coordinateKey(coordinate);
    if (horizontalCoords.has(key) && verticalCoords.has(key)) {
      pivotMap.set(key, { row: coordinate.row, column: coordinate.column });
    }
  }

  return [...pivotMap.values()].sort(compareCoordinates);
}

function choosePrimaryOrientation(group: MatchGroup): MatchOrientation {
  const [firstRun] = group.runs;
  if (!firstRun) {
    return 'horizontal';
  }

  const longestRun = group.runs.reduce(
    (currentLongest, run) =>
      run.coordinates.length > currentLongest.coordinates.length ? run : currentLongest,
    firstRun,
  );

  return longestRun.orientation;
}

export function classifyMatchGroup(group: MatchGroup): ClassifiedMatchGroup {
  const pivots = findMatchGroupPivots(group);
  const maximumRunLength = Math.max(...group.runs.map((run) => run.coordinates.length));
  const primaryOrientation = choosePrimaryOrientation(group);

  if (group.runs.length === 1) {
    const [run] = group.runs;
    const shape =
      run.coordinates.length === 3
        ? 'straight-3'
        : run.coordinates.length === 4
          ? 'straight-4'
          : 'straight-5-plus';
    return {
      group: {
        pieceType: group.pieceType,
        runs: group.runs.map((entry) => ({
          orientation: entry.orientation,
          pieceType: entry.pieceType,
          coordinates: entry.coordinates.map((coordinate) => ({ ...coordinate })),
        })),
        coordinates: group.coordinates.map((coordinate) => ({ ...coordinate })),
        bounds: { ...group.bounds },
      },
      shape,
      primaryOrientation: run.orientation,
      pivotCoordinates: [],
      maximumRunLength,
    };
  }

  let shape: MatchShape = 'complex';
  if (group.runs.length === 2 && pivots.length === 1) {
    const pivot = pivots[0];
    const directions = {
      up: group.coordinates.some(
        (coordinate) => coordinate.column === pivot.column && coordinate.row < pivot.row,
      ),
      down: group.coordinates.some(
        (coordinate) => coordinate.column === pivot.column && coordinate.row > pivot.row,
      ),
      left: group.coordinates.some(
        (coordinate) => coordinate.row === pivot.row && coordinate.column < pivot.column,
      ),
      right: group.coordinates.some(
        (coordinate) => coordinate.row === pivot.row && coordinate.column > pivot.column,
      ),
    };
    const directionCount = Object.values(directions).filter(Boolean).length;

    if (directionCount === 4) {
      shape = 'cross-shape';
    } else if (directionCount === 3) {
      shape = 't-shape';
    } else if (
      directionCount === 2 &&
      (directions.up || directions.down) &&
      (directions.left || directions.right)
    ) {
      shape = 'l-shape';
    }
  }

  return {
    group: {
      pieceType: group.pieceType,
      runs: group.runs.map((entry) => ({
        orientation: entry.orientation,
        pieceType: entry.pieceType,
        coordinates: entry.coordinates.map((coordinate) => ({ ...coordinate })),
      })),
      coordinates: group.coordinates.map((coordinate) => ({ ...coordinate })),
      bounds: { ...group.bounds },
    },
    shape,
    primaryOrientation,
    pivotCoordinates: pivots.map((coordinate) => ({ ...coordinate })),
    maximumRunLength,
  };
}

export function classifyMatchGroups(groups: MatchGroup[]): ClassifiedMatchGroup[] {
  return groups.map(classifyMatchGroup);
}
