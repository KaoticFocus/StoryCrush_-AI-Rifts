import { Board } from './Board';
import {
  AppliedSpecialCreation,
  ApplyMatchPlanResult,
  BoardCoordinate,
  BoardPiece,
  MatchPlanningResult,
  SpecialPieceCreationPlan,
} from './boardTypes';
import { BoardDomainError } from './errors';
import { cloneBoardPiece, createBoardPieceFromPlan } from './boardPieces';
import { cloneResolvableGrid, validateResolvableGrid } from './resolutionGrid';

function coordinateKey(coordinate: BoardCoordinate): string {
  return `${coordinate.row},${coordinate.column}`;
}

function cloneCoordinate(coordinate: BoardCoordinate): BoardCoordinate {
  return { row: coordinate.row, column: coordinate.column };
}

function coordinateMatches(left: BoardCoordinate, right: BoardCoordinate): boolean {
  return left.row === right.row && left.column === right.column;
}

function assertCoordinateAvailable(
  coordinate: BoardCoordinate,
  claimedCoordinates: Map<string, BoardCoordinate>,
  label: string,
): void {
  const key = coordinateKey(coordinate);
  const previous = claimedCoordinates.get(key);
  if (previous) {
    throw new BoardDomainError(
      'conflicting-creation-coordinates',
      `${label} ${key} was already claimed by another plan`,
    );
  }

  claimedCoordinates.set(key, cloneCoordinate(coordinate));
}

function validateCoordinateWithinGrid(
  coordinate: BoardCoordinate,
  rows: number,
  columns: number,
  label: string,
): void {
  if (
    !Number.isInteger(coordinate.row) ||
    !Number.isInteger(coordinate.column) ||
    coordinate.row < 0 ||
    coordinate.row >= rows ||
    coordinate.column < 0 ||
    coordinate.column >= columns
  ) {
    throw new BoardDomainError(
      'invalid-special-piece-plan',
      `${label} is outside the grid: row=${coordinate.row}, column=${coordinate.column}`,
    );
  }
}

function validateCreationBelongsToGroup(
  plan: SpecialPieceCreationPlan,
  rows: number,
  columns: number,
): void {
  validateCoordinateWithinGrid(plan.creationCoordinate, rows, columns, 'creation coordinate');
  if (
    !plan.group.group.coordinates.some((coordinate) =>
      coordinateMatches(coordinate, plan.creationCoordinate),
    )
  ) {
    throw new BoardDomainError(
      'invalid-special-piece-plan',
      'creation coordinate must belong to the source match group',
    );
  }
}

export function applyMatchPlanning(input: {
  board: Board | readonly (readonly (BoardPiece | null)[])[];
  planning: MatchPlanningResult;
}): ApplyMatchPlanResult {
  const sourceGrid =
    input.board instanceof Board ? input.board.toGridSnapshot() : cloneResolvableGrid(input.board);
  const { rows, columns } = validateResolvableGrid(sourceGrid);
  const gridAfterRemovalAndCreation = cloneResolvableGrid(sourceGrid);

  const removedCoordinateMap = new Map<string, BoardCoordinate>();
  const creationCoordinateClaims = new Set<string>();
  const createdSpecialPieces: AppliedSpecialCreation[] = [];
  const creationClaimMap = new Map<string, number>();

  for (const [groupIndex, group] of input.planning.groups.entries()) {
    const specialCreation = input.planning.specialCreations.find(
      (entry) => entry.groupIndex === groupIndex,
    );

    if (specialCreation) {
      validateCreationBelongsToGroup(specialCreation, rows, columns);
      const creationKey = coordinateKey(specialCreation.creationCoordinate);
      const currentClaim = creationClaimMap.get(creationKey);
      if (currentClaim !== undefined && currentClaim !== groupIndex) {
        throw new BoardDomainError(
          'conflicting-creation-coordinates',
          `multiple plans claim creation coordinate ${creationKey}`,
        );
      }
      creationClaimMap.set(creationKey, groupIndex);
      assertCoordinateAvailable(
        specialCreation.creationCoordinate,
        removedCoordinateMap,
        'creation coordinate',
      );
      creationCoordinateClaims.add(creationKey);
    }

    const coordinatesToRemove = specialCreation
      ? specialCreation.consumedCoordinates
      : group.group.coordinates;
    for (const coordinate of coordinatesToRemove) {
      validateCoordinateWithinGrid(coordinate, rows, columns, 'removal coordinate');
      if (!group.group.coordinates.some((entry) => coordinateMatches(entry, coordinate))) {
        throw new BoardDomainError(
          'invalid-special-piece-plan',
          'removal coordinate must belong to the source match group',
        );
      }

      const key = coordinateKey(coordinate);
      if (removedCoordinateMap.has(key)) {
        if (creationCoordinateClaims.has(key)) {
          throw new BoardDomainError(
            'conflicting-creation-coordinates',
            `removal coordinate ${key} conflicts with a creation coordinate`,
          );
        }

        continue;
      }

      removedCoordinateMap.set(key, cloneCoordinate(coordinate));
      gridAfterRemovalAndCreation[coordinate.row][coordinate.column] = null;
    }

    if (specialCreation) {
      const piece = createBoardPieceFromPlan(specialCreation);
      const creationCoordinate = specialCreation.creationCoordinate;
      const previousPiece =
        gridAfterRemovalAndCreation[creationCoordinate.row][creationCoordinate.column];
      gridAfterRemovalAndCreation[creationCoordinate.row][creationCoordinate.column] =
        cloneBoardPiece(piece);
      createdSpecialPieces.push({
        coordinate: cloneCoordinate(creationCoordinate),
        piece: cloneBoardPiece(piece),
        sourcePlan: specialCreation,
      });

      if (previousPiece === null) {
        // valid; the creation coordinate was removed as part of the same group only when it is a special.
      }
    }
  }

  return {
    gridAfterRemovalAndCreation: cloneResolvableGrid(gridAfterRemovalAndCreation),
    removedCoordinates: [...removedCoordinateMap.values()].sort((left, right) => {
      if (left.row !== right.row) {
        return left.row - right.row;
      }
      return left.column - right.column;
    }),
    createdSpecialPieces: createdSpecialPieces.map((entry) => ({
      coordinate: cloneCoordinate(entry.coordinate),
      piece: cloneBoardPiece(entry.piece),
      sourcePlan: entry.sourcePlan,
    })),
    planning: input.planning,
  };
}
