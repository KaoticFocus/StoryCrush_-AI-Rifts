import { BoardDomainError } from '../board/errors';
import {
  LevelDefinition,
  ObjectiveProgress,
  ObjectiveProgressUpdate,
  PieceCollectionEvent,
} from './levelTypes';
import { isCollectObjective, isScoreObjective } from './levelValidation';

function cloneProgress(progress: ObjectiveProgress): ObjectiveProgress {
  return {
    objectiveId: progress.objectiveId,
    kind: progress.kind,
    current: progress.current,
    target: progress.target,
    complete: progress.complete,
  };
}

export function createInitialObjectiveProgress(input: {
  definition: LevelDefinition;
  initialScore?: number;
}): ObjectiveProgress[] {
  const initialScore = input.initialScore ?? 0;
  if (!Number.isSafeInteger(initialScore) || initialScore < 0) {
    throw new BoardDomainError(
      'invalid-level-state',
      `initialScore must be a non-negative safe integer; received ${String(initialScore)}`,
    );
  }

  return input.definition.objectives.map((objective) => {
    if (isScoreObjective(objective)) {
      return {
        objectiveId: objective.id,
        kind: objective.kind,
        current: initialScore,
        target: objective.targetScore,
        complete: initialScore >= objective.targetScore,
      };
    }

    return {
      objectiveId: objective.id,
      kind: objective.kind,
      current: 0,
      target: objective.targetCount,
      complete: false,
    };
  });
}

function collectionCountsByType(events: readonly PieceCollectionEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.pieceType, (counts.get(event.pieceType) ?? 0) + 1);
  }

  return counts;
}

function safeAdd(a: number, b: number, label: string): number {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) {
    throw new BoardDomainError('score-overflow', `${label} overflowed safe integer range`);
  }

  return sum;
}

export function updateObjectiveProgress(input: {
  definition: LevelDefinition;
  previousProgress: ObjectiveProgress[];
  nextScore: number;
  scoreDelta: number;
  collectionEvents: readonly PieceCollectionEvent[];
}): {
  nextProgress: ObjectiveProgress[];
  updates: ObjectiveProgressUpdate[];
} {
  if (input.previousProgress.length !== input.definition.objectives.length) {
    throw new BoardDomainError(
      'level-state-mismatch',
      'previousProgress length does not match objective definitions',
    );
  }

  const collectionCounts = collectionCountsByType(input.collectionEvents);
  const nextProgress: ObjectiveProgress[] = [];
  const updates: ObjectiveProgressUpdate[] = [];

  input.definition.objectives.forEach((objective, index) => {
    const previous = input.previousProgress[index];
    if (previous.objectiveId !== objective.id || previous.kind !== objective.kind) {
      throw new BoardDomainError(
        'level-state-mismatch',
        `objective progress mismatch at index ${index}`,
      );
    }

    let nextCurrent = previous.current;
    let delta = 0;

    if (isScoreObjective(objective)) {
      if (previous.current < 0 || !Number.isSafeInteger(previous.current)) {
        throw new BoardDomainError(
          'invalid-level-state',
          'invalid previous score objective progress',
        );
      }

      if (nextCurrent > input.nextScore) {
        throw new BoardDomainError(
          'invalid-level-state',
          `score objective ${objective.id} progress cannot exceed session score`,
        );
      }

      delta = input.scoreDelta;
      nextCurrent = input.nextScore;
    } else if (isCollectObjective(objective)) {
      delta = collectionCounts.get(objective.pieceType) ?? 0;
      nextCurrent = safeAdd(
        previous.current,
        delta,
        `collection objective progress for ${objective.id}`,
      );
    }

    if (nextCurrent < previous.current) {
      throw new BoardDomainError(
        'invalid-level-state',
        `objective progress for ${objective.id} cannot decrease`,
      );
    }

    const target = isScoreObjective(objective) ? objective.targetScore : objective.targetCount;
    const next: ObjectiveProgress = {
      objectiveId: objective.id,
      kind: objective.kind,
      current: nextCurrent,
      target,
      complete: nextCurrent >= target,
    };

    nextProgress.push(cloneProgress(next));
    updates.push({
      objectiveId: objective.id,
      previous: cloneProgress(previous),
      next: cloneProgress(next),
      delta,
      completedThisMove: !previous.complete && next.complete,
    });
  });

  return {
    nextProgress,
    updates,
  };
}

export function areAllObjectivesComplete(progress: readonly ObjectiveProgress[]): boolean {
  return progress.every((entry) => entry.complete);
}
