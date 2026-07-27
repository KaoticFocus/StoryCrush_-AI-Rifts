import { applyGravity } from './applyGravity';
import { Board } from './Board';
import {
  AppliedSpecialCreation,
  CascadeResolutionResult,
  CascadeStep,
  MatchDetectionResult,
  MatchPlanningResult,
  RandomSource,
  ResolveCascadeInput,
  ResolutionStepCause,
  ResolvableGrid,
  SpecialActivationTrigger,
  SpecialPieceCreationPlan,
} from './boardTypes';
import { createBoardPieceFromPlan } from './boardPieces';
import { BoardDomainError } from './errors';
import { findMatchRuns } from './matchDetection';
import { validatePlayableSwap } from './playableSwapValidation';
import { refillBoard } from './refillBoard';
import { removeMatchedCoordinates } from './removeMatches';
import { cloneResolvableGrid } from './resolutionGrid';
import { SeededRandom } from './seededRandom';
import { DEFAULT_MAX_SPECIAL_ACTIVATIONS, resolveSpecialActivations } from './specialActivation';
import { planSpecialPieceCreations } from './specialPiecePlanning';

export const DEFAULT_MAX_CASCADE_STEPS = 100;

function coordinateKey(coordinate: { row: number; column: number }): string {
  return `${coordinate.row},${coordinate.column}`;
}

function compareCoordinates(
  left: { row: number; column: number },
  right: { row: number; column: number },
): number {
  if (left.row !== right.row) {
    return left.row - right.row;
  }

  return left.column - right.column;
}

function cloneMatchResult(result: MatchDetectionResult): MatchDetectionResult {
  return {
    runs: result.runs.map((run) => ({
      orientation: run.orientation,
      pieceType: run.pieceType,
      coordinates: run.coordinates.map((coordinate) => ({ ...coordinate })),
    })),
    matchedCoordinates: result.matchedCoordinates.map((coordinate) => ({ ...coordinate })),
  };
}

function cloneGrid(grid: ResolvableGrid): ResolvableGrid {
  return cloneResolvableGrid(grid);
}

function validateCascadeLimit(maxCascadeSteps: number): number {
  if (!Number.isInteger(maxCascadeSteps) || maxCascadeSteps <= 0) {
    throw new BoardDomainError(
      'invalid-cascade-limit',
      `maxCascadeSteps must be an integer greater than zero; received ${String(maxCascadeSteps)}`,
    );
  }

  return maxCascadeSteps;
}

function resolveRandomSource(input: ResolveCascadeInput): RandomSource {
  if (input.randomSource) {
    return input.randomSource;
  }

  if (input.seed === undefined) {
    throw new BoardDomainError(
      'invalid-seed',
      'resolveCascade requires either randomSource or integer seed',
    );
  }

  return new SeededRandom(input.seed);
}

function clonePlanning(planning: MatchPlanningResult): MatchPlanningResult {
  return {
    groups: planning.groups.map((group) => ({
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
    })),
    specialCreations: planning.specialCreations.map((creation) => ({
      groupIndex: creation.groupIndex,
      sourcePieceType: creation.sourcePieceType,
      matchShape: creation.matchShape,
      creationCoordinate: { ...creation.creationCoordinate },
      specialPiece: { ...creation.specialPiece },
      consumedCoordinates: creation.consumedCoordinates.map((coordinate) => ({ ...coordinate })),
      group: {
        group: {
          pieceType: creation.group.group.pieceType,
          runs: creation.group.group.runs.map((run) => ({
            orientation: run.orientation,
            pieceType: run.pieceType,
            coordinates: run.coordinates.map((coordinate) => ({ ...coordinate })),
          })),
          coordinates: creation.group.group.coordinates.map((coordinate) => ({ ...coordinate })),
          bounds: { ...creation.group.group.bounds },
        },
        shape: creation.group.shape,
        primaryOrientation: creation.group.primaryOrientation,
        pivotCoordinates: creation.group.pivotCoordinates.map((coordinate) => ({ ...coordinate })),
        maximumRunLength: creation.group.maximumRunLength,
      },
    })),
  };
}

function applySpecialCreations(input: {
  gridAfterRemoval: ResolvableGrid;
  plans: readonly SpecialPieceCreationPlan[];
}): {
  gridAfterRemovalAndCreation: ResolvableGrid;
  createdSpecialPieces: AppliedSpecialCreation[];
} {
  const nextGrid = cloneResolvableGrid(input.gridAfterRemoval);
  const createdSpecialPieces: AppliedSpecialCreation[] = [];

  for (const plan of input.plans) {
    const piece = createBoardPieceFromPlan(plan);
    const coordinate = plan.creationCoordinate;
    nextGrid[coordinate.row][coordinate.column] = piece;
    createdSpecialPieces.push({
      coordinate: { ...coordinate },
      piece: { ...piece },
      sourcePlan: plan,
    });
  }

  return {
    gridAfterRemovalAndCreation: cloneResolvableGrid(nextGrid),
    createdSpecialPieces,
  };
}

function collectMatchedSpecialTriggers(
  board: Board,
  matches: MatchDetectionResult,
): SpecialActivationTrigger[] {
  const triggers: SpecialActivationTrigger[] = [];

  for (const coordinate of matches.matchedCoordinates) {
    const piece = board.getPieceAt(coordinate);
    if (piece.kind === 'standard') {
      continue;
    }

    triggers.push({
      coordinate: { ...coordinate },
      reason: 'matched',
    });
  }

  return triggers.sort((left, right) => compareCoordinates(left.coordinate, right.coordinate));
}

function unionCoordinates(
  first: readonly { row: number; column: number }[],
  second: readonly { row: number; column: number }[],
): Array<{ row: number; column: number }> {
  const map = new Map<string, { row: number; column: number }>();

  for (const coordinate of first) {
    map.set(coordinateKey(coordinate), { ...coordinate });
  }

  for (const coordinate of second) {
    map.set(coordinateKey(coordinate), { ...coordinate });
  }

  return [...map.values()].sort(compareCoordinates);
}

export function resolveCascade(input: ResolveCascadeInput): CascadeResolutionResult {
  const maxCascadeSteps = validateCascadeLimit(input.maxCascadeSteps ?? DEFAULT_MAX_CASCADE_STEPS);
  const randomSource = resolveRandomSource(input);

  const { board, first, second, pieceTypes } = input;
  const playableSwap = validatePlayableSwap(board, first, second);

  if (!playableSwap.isValid) {
    return {
      isValid: false,
      initialBoard: board,
      finalBoard: board,
      swap: {
        from: { ...first },
        to: { ...second },
      },
      reason: playableSwap.reason ?? 'structurally-invalid',
      structuralReason: playableSwap.structuralReason,
    };
  }

  const boardAfterSwap = playableSwap.board;
  let currentBoard = boardAfterSwap;
  const steps: CascadeStep[] = [];
  const initialDirectTriggers = (playableSwap.directActivationTriggers ?? []).map((trigger) => ({
    coordinate: { ...trigger.coordinate },
    reason: trigger.reason,
    wildcardTarget: trigger.wildcardTarget ? { ...trigger.wildcardTarget } : undefined,
  }));

  while (true) {
    if (steps.length >= maxCascadeSteps) {
      throw new BoardDomainError(
        'cascade-limit-exceeded',
        `cascade resolution exceeded maxCascadeSteps=${maxCascadeSteps}`,
      );
    }

    const currentMatches = findMatchRuns(currentBoard);
    const hasDirectTriggerStep = steps.length === 0 && initialDirectTriggers.length > 0;
    if (currentMatches.runs.length === 0 && !hasDirectTriggerStep) {
      break;
    }

    const boardBeforeResolution = currentBoard;
    const swapContext =
      steps.length === 0
        ? {
            from: { ...first },
            to: { ...second },
          }
        : undefined;

    const matchPlanning = planSpecialPieceCreations({
      matches: currentMatches,
      swap: swapContext,
    });

    const matchedSpecialTriggers = collectMatchedSpecialTriggers(
      boardBeforeResolution,
      currentMatches,
    );
    const initialActivationTriggers: SpecialActivationTrigger[] = [
      ...(steps.length === 0 ? initialDirectTriggers : []),
      ...matchedSpecialTriggers,
    ];

    const activationResult = resolveSpecialActivations({
      board: boardBeforeResolution,
      initialTriggers: initialActivationTriggers,
      maxSpecialActivations: input.maxSpecialActivations ?? DEFAULT_MAX_SPECIAL_ACTIVATIONS,
    });

    const totalAffectedCoordinates = unionCoordinates(
      currentMatches.matchedCoordinates,
      activationResult.affectedCoordinates,
    );

    const protectedCreationCoordinates = new Set(
      matchPlanning.specialCreations.map((creation) => coordinateKey(creation.creationCoordinate)),
    );

    const actualRemovedCoordinates = totalAffectedCoordinates
      .filter((coordinate) => !protectedCreationCoordinates.has(coordinateKey(coordinate)))
      .sort(compareCoordinates)
      .map((coordinate) => ({ ...coordinate }));

    const gridAfterRemoval = removeMatchedCoordinates(
      boardBeforeResolution,
      actualRemovedCoordinates,
    );
    const creationResult = applySpecialCreations({
      gridAfterRemoval,
      plans: matchPlanning.specialCreations,
    });

    const gridAfterGravity = applyGravity(creationResult.gridAfterRemovalAndCreation);
    const refillResult = refillBoard(gridAfterGravity, pieceTypes, randomSource);

    const isFirstStep = steps.length === 0;
    const cause: ResolutionStepCause = isFirstStep
      ? playableSwap.kind === 'ordinary-match'
        ? 'ordinary-match'
        : 'direct-special-swap'
      : 'cascade';

    const step: CascadeStep = {
      index: steps.length,
      cause,
      boardBeforeResolution,
      boardBeforeRemoval: boardBeforeResolution,
      matches: cloneMatchResult(currentMatches),
      matchPlanning: clonePlanning(matchPlanning),
      initialActivationTriggers: initialActivationTriggers.map((trigger) => ({
        coordinate: { ...trigger.coordinate },
        reason: trigger.reason,
        wildcardTarget: trigger.wildcardTarget ? { ...trigger.wildcardTarget } : undefined,
      })),
      activationEvents: activationResult.events.map((event) => ({
        index: event.index,
        coordinate: { ...event.coordinate },
        piece: { ...event.piece },
        reason: event.reason,
        wildcardTarget: event.wildcardTarget ? { ...event.wildcardTarget } : undefined,
        affectedCoordinates: event.affectedCoordinates.map((coordinate) => ({ ...coordinate })),
        newlyTriggeredSpecialCoordinates: event.newlyTriggeredSpecialCoordinates.map(
          (coordinate) => ({
            ...coordinate,
          }),
        ),
      })),
      totalAffectedCoordinates: totalAffectedCoordinates.map((coordinate) => ({ ...coordinate })),
      actualRemovedCoordinates: actualRemovedCoordinates.map((coordinate) => ({ ...coordinate })),
      createdSpecialPieces: creationResult.createdSpecialPieces.map((creation) => ({
        coordinate: { ...creation.coordinate },
        piece: { ...creation.piece },
        sourcePlan: {
          ...creation.sourcePlan,
          creationCoordinate: { ...creation.sourcePlan.creationCoordinate },
          consumedCoordinates: creation.sourcePlan.consumedCoordinates.map((coordinate) => ({
            ...coordinate,
          })),
          specialPiece: { ...creation.sourcePlan.specialPiece },
          group: {
            group: {
              pieceType: creation.sourcePlan.group.group.pieceType,
              runs: creation.sourcePlan.group.group.runs.map((run) => ({
                orientation: run.orientation,
                pieceType: run.pieceType,
                coordinates: run.coordinates.map((coordinate) => ({ ...coordinate })),
              })),
              coordinates: creation.sourcePlan.group.group.coordinates.map((coordinate) => ({
                ...coordinate,
              })),
              bounds: { ...creation.sourcePlan.group.group.bounds },
            },
            shape: creation.sourcePlan.group.shape,
            primaryOrientation: creation.sourcePlan.group.primaryOrientation,
            pivotCoordinates: creation.sourcePlan.group.pivotCoordinates.map((coordinate) => ({
              ...coordinate,
            })),
            maximumRunLength: creation.sourcePlan.group.maximumRunLength,
          },
        },
      })),
      removedCoordinates: actualRemovedCoordinates.map((coordinate) => ({ ...coordinate })),
      gridAfterRemoval: cloneGrid(gridAfterRemoval),
      gridAfterRemovalAndCreation: cloneGrid(creationResult.gridAfterRemovalAndCreation),
      gridAfterGravity: cloneGrid(gridAfterGravity),
      refillPlacements: refillResult.placements.map((placement) => ({
        coordinate: { ...placement.coordinate },
        piece: { ...placement.piece },
      })),
      boardAfterRefill: refillResult.board,
    };

    steps.push(step);
    currentBoard = refillResult.board;
  }

  return {
    isValid: true,
    initialBoard: board,
    boardAfterSwap,
    swap: {
      from: { ...first },
      to: { ...second },
    },
    steps,
    finalBoard: currentBoard,
    cascadeCount: steps.length,
  };
}
