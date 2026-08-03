import {
  BoardCoordinate,
  ClassifiedMatchGroup,
  MatchDetectionResult,
  MatchPlanningResult,
  PlannedSpecialPiece,
  SpecialCreationContext,
  SpecialPieceCreationPlan,
} from './boardTypes';
import { BoardDomainError } from './errors';
import { classifyMatchGroups, groupMatchRuns } from './matchGroups';

function cloneCoordinate(coordinate: BoardCoordinate): BoardCoordinate {
  return { row: coordinate.row, column: coordinate.column };
}

function compareCoordinates(left: BoardCoordinate, right: BoardCoordinate): number {
  if (left.row !== right.row) {
    return left.row - right.row;
  }

  return left.column - right.column;
}

function nearestToCenter(coordinates: readonly BoardCoordinate[]): BoardCoordinate {
  const bounds = coordinates.reduce(
    (accumulator, coordinate) => ({
      minRow: Math.min(accumulator.minRow, coordinate.row),
      minColumn: Math.min(accumulator.minColumn, coordinate.column),
      maxRow: Math.max(accumulator.maxRow, coordinate.row),
      maxColumn: Math.max(accumulator.maxColumn, coordinate.column),
    }),
    {
      minRow: Number.POSITIVE_INFINITY,
      minColumn: Number.POSITIVE_INFINITY,
      maxRow: Number.NEGATIVE_INFINITY,
      maxColumn: Number.NEGATIVE_INFINITY,
    },
  );
  const centerRow = (bounds.minRow + bounds.maxRow) / 2;
  const centerColumn = (bounds.minColumn + bounds.maxColumn) / 2;

  return [...coordinates].sort((left, right) => {
    const leftDistance = (left.row - centerRow) ** 2 + (left.column - centerColumn) ** 2;
    const rightDistance = (right.row - centerRow) ** 2 + (right.column - centerColumn) ** 2;
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return compareCoordinates(left, right);
  })[0];
}

function determineSpecialPiece(
  classifiedGroup: ClassifiedMatchGroup,
): PlannedSpecialPiece | undefined {
  const { shape, group } = classifiedGroup;
  const longestRun = classifiedGroup.maximumRunLength;
  const primaryOrientation = classifiedGroup.primaryOrientation;

  if (shape === 'straight-3') {
    return undefined;
  }

  if (shape === 'straight-4') {
    // Stored orientation is the cleared line (perpendicular to the creating match).
    if (!primaryOrientation) {
      throw new BoardDomainError(
        'invalid-special-piece-plan',
        'straight-4 matches require a primary orientation',
      );
    }
    return {
      kind: 'line-clear',
      pieceType: group.pieceType,
      orientation: primaryOrientation === 'horizontal' ? 'vertical' : 'horizontal',
    };
  }

  if (shape === 'straight-5-plus') {
    return {
      kind: 'wildcard',
      pieceType: group.pieceType,
    };
  }

  if (shape === 'l-shape' || shape === 't-shape' || shape === 'cross-shape') {
    return {
      kind: 'cross-clear',
      pieceType: group.pieceType,
    };
  }

  if (longestRun >= 5) {
    return {
      kind: 'wildcard',
      pieceType: group.pieceType,
    };
  }

  if (
    group.runs.some((run) => run.orientation === 'horizontal') &&
    group.runs.some((run) => run.orientation === 'vertical')
  ) {
    return {
      kind: 'cross-clear',
      pieceType: group.pieceType,
    };
  }

  if (longestRun === 4) {
    const lineRun = group.runs.find((run) => run.coordinates.length === 4) ?? group.runs[0];
    return {
      kind: 'line-clear',
      pieceType: group.pieceType,
      orientation: lineRun.orientation === 'horizontal' ? 'vertical' : 'horizontal',
    };
  }

  return undefined;
}

function selectFromGroup(
  classifiedGroup: ClassifiedMatchGroup,
  swap?: SpecialCreationContext['swap'],
): BoardCoordinate {
  const coordinates = classifiedGroup.group.coordinates;
  if (swap?.to && coordinates.some((coordinate) => compareCoordinates(coordinate, swap.to) === 0)) {
    return cloneCoordinate(swap.to);
  }

  if (
    swap?.from &&
    coordinates.some((coordinate) => compareCoordinates(coordinate, swap.from) === 0)
  ) {
    return cloneCoordinate(swap.from);
  }

  if (
    classifiedGroup.shape === 'l-shape' ||
    classifiedGroup.shape === 't-shape' ||
    classifiedGroup.shape === 'cross-shape'
  ) {
    return cloneCoordinate(classifiedGroup.pivotCoordinates[0]);
  }

  if (
    classifiedGroup.shape === 'straight-3' ||
    classifiedGroup.shape === 'straight-4' ||
    classifiedGroup.shape === 'straight-5-plus'
  ) {
    return cloneCoordinate(nearestToCenter(coordinates));
  }

  if (classifiedGroup.pivotCoordinates.length > 0) {
    return cloneCoordinate(classifiedGroup.pivotCoordinates[0]);
  }

  return cloneCoordinate(nearestToCenter(coordinates));
}

function coordinateMatches(left: BoardCoordinate, right: BoardCoordinate): boolean {
  return left.row === right.row && left.column === right.column;
}

function cloneGroup(group: ClassifiedMatchGroup): ClassifiedMatchGroup {
  return {
    group: {
      pieceType: group.group.pieceType,
      runs: group.group.runs.map((run) => ({
        orientation: run.orientation,
        pieceType: run.pieceType,
        coordinates: run.coordinates.map((coordinate) => ({ ...coordinate })),
      })),
      coordinates: group.group.coordinates.map((coordinate) => ({ ...coordinate })),
      bounds: { ...group.group.bounds },
    },
    shape: group.shape,
    primaryOrientation: group.primaryOrientation,
    pivotCoordinates: group.pivotCoordinates.map((coordinate) => ({ ...coordinate })),
    maximumRunLength: group.maximumRunLength,
  };
}

export function selectSpecialCreationCoordinate(
  classifiedGroup: ClassifiedMatchGroup,
  context?: SpecialCreationContext,
): BoardCoordinate {
  return selectFromGroup(classifiedGroup, context?.swap);
}

export function planSpecialPieceCreations(input: {
  matches: MatchDetectionResult;
  swap?: SpecialCreationContext['swap'];
}): MatchPlanningResult {
  const groups = classifyMatchGroups(groupMatchRuns(input.matches));
  const clonedGroups = groups.map(cloneGroup);
  const specialCreations: SpecialPieceCreationPlan[] = [];

  clonedGroups.forEach((group, groupIndex) => {
    const specialPiece = determineSpecialPiece(group);
    if (!specialPiece) {
      return;
    }

    const creationCoordinate = selectSpecialCreationCoordinate(group, { swap: input.swap });
    if (
      !group.group.coordinates.some((coordinate) =>
        coordinateMatches(coordinate, creationCoordinate),
      )
    ) {
      throw new BoardDomainError(
        'invalid-special-piece-plan',
        'selected creation coordinate must belong to the match group',
      );
    }

    specialCreations.push({
      groupIndex,
      sourcePieceType: group.group.pieceType,
      matchShape: group.shape,
      creationCoordinate: cloneCoordinate(creationCoordinate),
      specialPiece,
      consumedCoordinates: group.group.coordinates
        .filter((coordinate) => !coordinateMatches(coordinate, creationCoordinate))
        .map((coordinate) => ({ ...coordinate })),
      group,
    });
  });

  return {
    groups: clonedGroups,
    specialCreations,
  };
}
