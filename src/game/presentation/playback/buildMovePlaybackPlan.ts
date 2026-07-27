import { type AppliedSpecialCreation } from '../../board/boardTypes';
import { cloneResolvableGrid } from '../../board/resolutionGrid';
import { type BoardCoordinate } from '../../board';
import {
  type AcceptedLevelMoveResult,
  type LevelMoveResult,
  type LevelObjectiveDefinition,
} from '../../level';
import { planGravityMovements } from './gravityMovementPlanning';
import { buildObjectivePresentationPlan } from './objectivePresentationPlanning';
import { planReshuffleMovements } from './reshuffleMovementPlanning';
import { buildScorePresentationPlan } from './scorePresentationPlanning';
import { buildSpecialEffectPresentation } from './specialEffectPlanning';
import { type BoardSnapshot, type MovePlaybackPlan, type PlaybackCommand } from './playbackTypes';
import { planRefillPresentation } from './refillPresentationPlanning';

function cloneCoordinate(coordinate: BoardCoordinate): BoardCoordinate {
  return { row: coordinate.row, column: coordinate.column };
}

function cloneBoardSnapshot(board: { toGridSnapshot(): BoardSnapshot }): BoardSnapshot {
  return board.toGridSnapshot().map((row) => row.map((piece) => ({ ...piece })));
}

function cloneCreatedSpecials(
  creations: readonly AppliedSpecialCreation[],
): AppliedSpecialCreation[] {
  return creations.map((creation) => ({
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
        ...creation.sourcePlan.group,
        group: {
          ...creation.sourcePlan.group.group,
          runs: creation.sourcePlan.group.group.runs.map((run) => ({
            ...run,
            coordinates: run.coordinates.map((coordinate) => ({ ...coordinate })),
          })),
          coordinates: creation.sourcePlan.group.group.coordinates.map((coordinate) => ({
            ...coordinate,
          })),
          bounds: { ...creation.sourcePlan.group.group.bounds },
        },
        pivotCoordinates: creation.sourcePlan.group.pivotCoordinates.map((coordinate) => ({
          ...coordinate,
        })),
      },
    },
  }));
}

export function buildMovePlaybackPlan(
  result: LevelMoveResult,
  objectiveDefinitions: readonly LevelObjectiveDefinition[],
): MovePlaybackPlan {
  if (!result.accepted) {
    throw new Error('buildMovePlaybackPlan requires an accepted level move result');
  }

  const acceptedResult: AcceptedLevelMoveResult = result;
  const commands: PlaybackCommand[] = [];
  const scorePlan = buildScorePresentationPlan(acceptedResult);
  const objectivePlan = buildObjectivePresentationPlan({
    result: acceptedResult,
    definition: { objectives: objectiveDefinitions },
  });
  let commandIndex = 0;

  const scoreEntriesByActivation = new Map<string, (typeof scorePlan.entries)[number]>();
  const scoreEntriesByStep = new Map<number, (typeof scorePlan.entries)[number]>();
  const scoreObjectiveFeedbackByScoreIndex = new Map<number, typeof objectivePlan.scoreFeedback>();
  const collectionFeedbackByStep = new Map<number, typeof objectivePlan.collectionFeedback>();
  const collectionEventsByStep = new Map<number, typeof acceptedResult.collectionEvents>();

  for (const scoreEntry of scorePlan.entries) {
    if (scoreEntry.event.kind === 'special-activation') {
      scoreEntriesByActivation.set(
        `${scoreEntry.event.stepIndex}:${scoreEntry.event.activationIndex}`,
        scoreEntry,
      );
      continue;
    }

    scoreEntriesByStep.set(scoreEntry.event.stepIndex, scoreEntry);
  }

  for (const feedback of objectivePlan.scoreFeedback) {
    const entries = scoreObjectiveFeedbackByScoreIndex.get(feedback.scoreEventIndex) ?? [];
    entries.push({ ...feedback });
    scoreObjectiveFeedbackByScoreIndex.set(feedback.scoreEventIndex, entries);
  }

  for (const feedback of objectivePlan.collectionFeedback) {
    const entries = collectionFeedbackByStep.get(feedback.stepIndex) ?? [];
    entries.push({
      ...feedback,
      eventPlans: feedback.eventPlans.map((eventPlan) => ({
        ...eventPlan,
        sourceCoordinate: { ...eventPlan.sourceCoordinate },
      })),
    });
    collectionFeedbackByStep.set(feedback.stepIndex, entries);
  }

  for (const collectionEvent of acceptedResult.collectionEvents) {
    const events = collectionEventsByStep.get(collectionEvent.stepIndex) ?? [];
    events.push({
      ...collectionEvent,
      coordinate: { ...collectionEvent.coordinate },
      piece: { ...collectionEvent.piece },
    });
    collectionEventsByStep.set(collectionEvent.stepIndex, events);
  }

  commands.push({
    kind: 'swap',
    index: commandIndex,
    stepIndex: null,
    from: cloneCoordinate(acceptedResult.requestedSwap.from),
    to: cloneCoordinate(acceptedResult.requestedSwap.to),
    boardBefore: cloneBoardSnapshot(acceptedResult.previousState.board),
    boardAfter: cloneBoardSnapshot(acceptedResult.resolution.boardAfterSwap),
  });
  commandIndex += 1;

  for (const step of acceptedResult.resolution.steps) {
    commands.push({
      kind: 'highlight-matches',
      index: commandIndex,
      stepIndex: step.index,
      matchedCoordinates: step.matches.matchedCoordinates.map(cloneCoordinate),
      createdSpecialCoordinates: step.createdSpecialPieces.map((creation) => ({
        ...creation.coordinate,
      })),
    });
    commandIndex += 1;

    for (const activation of step.activationEvents) {
      commands.push({
        kind: 'special-activation',
        index: commandIndex,
        stepIndex: step.index,
        activation: {
          ...activation,
          coordinate: { ...activation.coordinate },
          piece: { ...activation.piece },
          wildcardTarget: activation.wildcardTarget ? { ...activation.wildcardTarget } : undefined,
          affectedCoordinates: activation.affectedCoordinates.map(cloneCoordinate),
          newlyTriggeredSpecialCoordinates:
            activation.newlyTriggeredSpecialCoordinates.map(cloneCoordinate),
        },
        effectPlan: buildSpecialEffectPresentation({
          event: activation,
          dimensions: step.boardBeforeResolution.getDimensions(),
        }),
      });
      commandIndex += 1;

      const linkedScoreEntry = scoreEntriesByActivation.get(`${step.index}:${activation.index}`);
      if (linkedScoreEntry) {
        commands.push({
          kind: 'score-feedback',
          index: commandIndex,
          stepIndex: step.index,
          scoreEntry: {
            ...linkedScoreEntry,
            event: { ...linkedScoreEntry.event },
          },
          linkedObjectiveFeedback: (
            scoreObjectiveFeedbackByScoreIndex.get(linkedScoreEntry.index) ?? []
          ).map((feedback) => ({ ...feedback })),
        });
        commandIndex += 1;
      }
    }

    commands.push({
      kind: 'remove-pieces',
      index: commandIndex,
      stepIndex: step.index,
      removedCoordinates: step.actualRemovedCoordinates.map(cloneCoordinate),
      boardBeforeRemoval: cloneBoardSnapshot(step.boardBeforeRemoval),
      gridAfterRemoval: cloneResolvableGrid(step.gridAfterRemoval),
    });
    commandIndex += 1;

    const stepScoreEntry = scoreEntriesByStep.get(step.index);
    if (stepScoreEntry) {
      commands.push({
        kind: 'score-feedback',
        index: commandIndex,
        stepIndex: step.index,
        scoreEntry: {
          ...stepScoreEntry,
          event: { ...stepScoreEntry.event },
        },
        linkedObjectiveFeedback: (
          scoreObjectiveFeedbackByScoreIndex.get(stepScoreEntry.index) ?? []
        ).map((feedback) => ({ ...feedback })),
      });
      commandIndex += 1;
    }

    const stepCollectionFeedback = collectionFeedbackByStep.get(step.index) ?? [];
    if (stepCollectionFeedback.length > 0) {
      commands.push({
        kind: 'objective-feedback',
        index: commandIndex,
        stepIndex: step.index,
        collectionFeedback: stepCollectionFeedback.map((feedback) => ({
          ...feedback,
          eventPlans: feedback.eventPlans.map((eventPlan) => ({
            ...eventPlan,
            sourceCoordinate: { ...eventPlan.sourceCoordinate },
          })),
        })),
        collectionEvents: (collectionEventsByStep.get(step.index) ?? []).map((event) => ({
          ...event,
          coordinate: { ...event.coordinate },
          piece: { ...event.piece },
        })),
      });
      commandIndex += 1;
    }

    if (step.createdSpecialPieces.length > 0) {
      commands.push({
        kind: 'create-specials',
        index: commandIndex,
        stepIndex: step.index,
        createdSpecialPieces: cloneCreatedSpecials(step.createdSpecialPieces),
        gridAfterCreation: cloneResolvableGrid(step.gridAfterRemovalAndCreation),
      });
      commandIndex += 1;
    }

    commands.push({
      kind: 'apply-gravity',
      index: commandIndex,
      stepIndex: step.index,
      gridBefore: cloneResolvableGrid(step.gridAfterRemovalAndCreation),
      gridAfter: cloneResolvableGrid(step.gridAfterGravity),
      movements: planGravityMovements({
        gridBeforeGravity: step.gridAfterRemovalAndCreation,
        gridAfterGravity: step.gridAfterGravity,
      }),
    });
    commandIndex += 1;

    commands.push({
      kind: 'refill-pieces',
      index: commandIndex,
      stepIndex: step.index,
      gridBefore: cloneResolvableGrid(step.gridAfterGravity),
      boardAfter: cloneBoardSnapshot(step.boardAfterRefill),
      placements: step.refillPlacements.map((placement) => ({
        coordinate: { ...placement.coordinate },
        piece: { ...placement.piece },
      })),
      entries: planRefillPresentation({
        rows: step.boardAfterRefill.getDimensions().rows,
        placements: step.refillPlacements,
      }),
    });
    commandIndex += 1;

    if (step.index < acceptedResult.resolution.steps.length - 1) {
      commands.push({
        kind: 'cascade-pause',
        index: commandIndex,
        stepIndex: step.index,
        cascadeNumber: step.index + 2,
      });
      commandIndex += 1;
    }
  }

  if (acceptedResult.reshuffle) {
    commands.push({
      kind: 'reshuffle-movement',
      index: commandIndex,
      stepIndex: null,
      fromBoard: cloneBoardSnapshot(acceptedResult.reshuffle.originalBoard),
      toBoard: cloneBoardSnapshot(acceptedResult.reshuffle.reshuffledBoard),
      movementPlan: planReshuffleMovements({
        originalBoard: acceptedResult.reshuffle.originalBoard,
        reshuffledBoard: acceptedResult.reshuffle.reshuffledBoard,
      }),
    });
    commandIndex += 1;
  }

  commands.push({
    kind: 'synchronize-board',
    index: commandIndex,
    stepIndex: null,
    board: cloneBoardSnapshot(acceptedResult.nextState.board),
    score: acceptedResult.nextState.score,
    movesRemaining: acceptedResult.nextState.movesRemaining,
    status: acceptedResult.nextState.status,
    objectiveProgress: acceptedResult.nextState.objectiveProgress.map((progress) => ({
      ...progress,
    })),
  });

  return {
    requestedSwap: {
      from: cloneCoordinate(acceptedResult.requestedSwap.from),
      to: cloneCoordinate(acceptedResult.requestedSwap.to),
    },
    previousBoard: cloneBoardSnapshot(acceptedResult.previousState.board),
    finalBoard: cloneBoardSnapshot(acceptedResult.nextState.board),
    commands,
    summary: {
      scoreCalculation: {
        ...acceptedResult.scoreCalculation,
        events: acceptedResult.scoreCalculation.events.map((event) => ({ ...event })),
        stepTotals: acceptedResult.scoreCalculation.stepTotals.map((stepTotal) => ({
          ...stepTotal,
        })),
      },
      cascadeCount: acceptedResult.resolution.cascadeCount,
      activationCount: acceptedResult.resolution.steps.reduce(
        (count, step) => count + step.activationEvents.length,
        0,
      ),
    },
  };
}
