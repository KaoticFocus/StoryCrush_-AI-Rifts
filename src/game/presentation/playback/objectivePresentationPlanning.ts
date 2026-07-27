import { type AcceptedLevelMoveResult, type LevelObjectiveDefinition } from '../../level';
import { type BoardCoordinate, type PieceType } from '../../board';
import { buildScorePresentationPlan } from './scorePresentationPlanning';

export interface CollectionFeedbackPlan {
  sourceCoordinate: BoardCoordinate;
  objectiveId: string;
  pieceType: PieceType;
  eventIndex: number;
  stepIndex: number;
}

export interface CollectionObjectiveFeedback {
  objectiveId: string;
  stepIndex: number;
  delta: number;
  nextCurrent: number;
  completedThisMove: boolean;
  eventPlans: CollectionFeedbackPlan[];
}

export interface ScoreObjectiveFeedback {
  objectiveId: string;
  scoreEventIndex: number;
  delta: number;
  nextCurrent: number;
  completedThisMove: boolean;
}

export interface ObjectivePresentationPlan {
  collectionFeedback: CollectionObjectiveFeedback[];
  scoreFeedback: ScoreObjectiveFeedback[];
}

function cloneCoordinate(coordinate: BoardCoordinate): BoardCoordinate {
  return { row: coordinate.row, column: coordinate.column };
}

function isCollectObjective(
  objective: LevelObjectiveDefinition,
): objective is Extract<LevelObjectiveDefinition, { kind: 'collect-piece' }> {
  return objective.kind === 'collect-piece';
}

function isScoreObjective(
  objective: LevelObjectiveDefinition,
): objective is Extract<LevelObjectiveDefinition, { kind: 'score' }> {
  return objective.kind === 'score';
}

export function buildObjectivePresentationPlan(input: {
  result: AcceptedLevelMoveResult;
  definition: { objectives: readonly LevelObjectiveDefinition[] };
}): ObjectivePresentationPlan {
  const scorePlan = buildScorePresentationPlan(input.result);
  const collectionFeedback: CollectionObjectiveFeedback[] = [];
  const scoreFeedback: ScoreObjectiveFeedback[] = [];

  for (const update of input.result.objectiveUpdates) {
    const definition = input.definition.objectives.find(
      (objective) => objective.id === update.objectiveId,
    );
    if (!definition) {
      continue;
    }

    if (isCollectObjective(definition)) {
      const matchingEvents = input.result.collectionEvents
        .map((event, eventIndex) => ({ event, eventIndex }))
        .filter(({ event }) => event.pieceType === definition.pieceType);

      if (matchingEvents.length === 0) {
        continue;
      }

      const byStep = new Map<number, Array<(typeof matchingEvents)[number]>>();
      for (const entry of matchingEvents) {
        const stepEntries = byStep.get(entry.event.stepIndex) ?? [];
        stepEntries.push(entry);
        byStep.set(entry.event.stepIndex, stepEntries);
      }

      let current = update.previous.current;
      for (const [stepIndex, stepEntries] of [...byStep.entries()].sort(
        ([left], [right]) => left - right,
      )) {
        current += stepEntries.length;
        collectionFeedback.push({
          objectiveId: update.objectiveId,
          stepIndex,
          delta: stepEntries.length,
          nextCurrent: current,
          completedThisMove: !update.previous.complete && current >= update.next.target,
          eventPlans: stepEntries.map(({ event, eventIndex }) => ({
            sourceCoordinate: cloneCoordinate(event.coordinate),
            objectiveId: update.objectiveId,
            pieceType: event.pieceType,
            eventIndex,
            stepIndex: event.stepIndex,
          })),
        });
      }
      continue;
    }

    if (isScoreObjective(definition)) {
      const totalDelta = update.next.current - update.previous.current;
      if (totalDelta <= 0) {
        continue;
      }

      let remainingDelta = totalDelta;
      let current = update.previous.current;
      for (const scoreEntry of scorePlan.entries) {
        const appliedDelta = Math.min(remainingDelta, scoreEntry.event.awardedPoints);
        if (appliedDelta <= 0) {
          continue;
        }

        current += appliedDelta;
        remainingDelta -= appliedDelta;
        scoreFeedback.push({
          objectiveId: update.objectiveId,
          scoreEventIndex: scoreEntry.index,
          delta: appliedDelta,
          nextCurrent: current,
          completedThisMove: !update.previous.complete && current >= update.next.target,
        });
      }
    }
  }

  return {
    collectionFeedback,
    scoreFeedback,
  };
}
