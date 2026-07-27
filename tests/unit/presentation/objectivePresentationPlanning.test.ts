import { describe, expect, it } from 'vitest';
import { resolveCascade, validatePlayableSwap, type Board } from '../../../src/game/board';
import {
  createPieceCollectionEvents,
  type AcceptedLevelMoveResult,
  DEFAULT_SCORING_RULES,
  calculateResolutionScore,
  type LevelDefinition,
  type LevelSessionState,
  updateObjectiveProgress,
} from '../../../src/game/level';
import { buildObjectivePresentationPlan } from '../../../src/game/presentation/playback/objectivePresentationPlanning';
import { standardBoard } from '../board/boardTestHelpers';

class ScriptedRandom {
  private index = 0;

  public constructor(private readonly values: number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index] ?? 0;
    this.index += 1;
    return value % maxExclusive;
  }
}

function createDefinition(): LevelDefinition {
  return {
    id: 'objective-feedback',
    moveLimit: 5,
    allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
    objectives: [
      { id: 'score-main', kind: 'score', targetScore: 30 },
      { id: 'collect-ruby-a', kind: 'collect-piece', pieceType: 'ruby', targetCount: 2 },
      { id: 'collect-ruby-b', kind: 'collect-piece', pieceType: 'ruby', targetCount: 4 },
    ],
    scoring: DEFAULT_SCORING_RULES,
    seed: 28,
  };
}

function createState(board: Board, definition: LevelDefinition): LevelSessionState {
  return {
    levelId: definition.id,
    baseSeed: definition.seed,
    board,
    score: 0,
    movesRemaining: definition.moveLimit,
    acceptedMoveCount: 0,
    status: 'active',
    objectiveProgress: [
      { objectiveId: 'score-main', kind: 'score', current: 0, target: 30, complete: false },
      {
        objectiveId: 'collect-ruby-a',
        kind: 'collect-piece',
        current: 0,
        target: 2,
        complete: false,
      },
      {
        objectiveId: 'collect-ruby-b',
        kind: 'collect-piece',
        current: 0,
        target: 4,
        complete: false,
      },
    ],
  };
}

function createAcceptedMoveResult(): {
  result: AcceptedLevelMoveResult;
  definition: LevelDefinition;
} {
  const definition = createDefinition();
  const board = standardBoard([
    ['ruby', 'sapphire', 'ruby'],
    ['topaz', 'ruby', 'emerald'],
    ['amethyst', 'pearl', 'topaz'],
  ]);
  const from = { row: 0, column: 1 };
  const to = { row: 1, column: 1 };
  const resolution = resolveCascade({
    board,
    first: from,
    second: to,
    pieceTypes: definition.allowedRefillPieceTypes,
    randomSource: new ScriptedRandom([0, 1, 2]),
  });

  expect(resolution.isValid).toBe(true);
  if (!resolution.isValid) {
    throw new Error('Expected valid resolution');
  }

  const playableSwap = validatePlayableSwap(board, from, to);
  expect(playableSwap.isValid).toBe(true);
  if (!playableSwap.isValid || !playableSwap.kind) {
    throw new Error('Expected valid playable swap');
  }

  const previousState = createState(board, definition);
  const scoreCalculation = calculateResolutionScore({ resolution, rules: DEFAULT_SCORING_RULES });
  const collectionEvents = createPieceCollectionEvents({ resolution });
  const objectiveProgressResult = updateObjectiveProgress({
    definition,
    previousProgress: previousState.objectiveProgress,
    nextScore: previousState.score + scoreCalculation.totalAwardedPoints,
    scoreDelta: scoreCalculation.totalAwardedPoints,
    collectionEvents,
  });
  const nextState: LevelSessionState = {
    ...previousState,
    board: resolution.finalBoard,
    score: previousState.score + scoreCalculation.totalAwardedPoints,
    movesRemaining: previousState.movesRemaining - 1,
    acceptedMoveCount: 1,
    objectiveProgress: objectiveProgressResult.nextProgress,
  };

  return {
    definition,
    result: {
      accepted: true,
      requestedSwap: { from, to },
      moveKind: playableSwap.kind,
      previousState,
      nextState,
      previousStatus: 'active',
      nextStatus: 'won',
      scoreBefore: 0,
      scoreAfter: nextState.score,
      movesBefore: previousState.movesRemaining,
      movesAfter: nextState.movesRemaining,
      movesConsumed: 1,
      resolutionSeed: definition.seed,
      resolution,
      scoreCalculation,
      collectionEvents,
      objectiveUpdates: objectiveProgressResult.updates,
    },
  };
}

describe('buildObjectivePresentationPlan', () => {
  it('creates collection feedback for every matching objective, including duplicate piece-type targets', () => {
    const { definition, result } = createAcceptedMoveResult();
    const plan = buildObjectivePresentationPlan({ result, definition });

    expect(plan.collectionFeedback.length).toBe(2);
    expect(plan.collectionFeedback.every((entry) => entry.delta > 0)).toBe(true);
    expect(plan.collectionFeedback[0].eventPlans.length).toBe(result.collectionEvents.length);
    expect(plan.collectionFeedback.map((entry) => entry.objectiveId)).toEqual([
      'collect-ruby-a',
      'collect-ruby-b',
    ]);
  });

  it('creates score-objective feedback in score-event order with cumulative progress', () => {
    const { definition, result } = createAcceptedMoveResult();
    const plan = buildObjectivePresentationPlan({ result, definition });

    expect(plan.scoreFeedback.map((entry) => entry.scoreEventIndex)).toEqual(
      plan.scoreFeedback.map((_, index) => index),
    );
    expect(plan.scoreFeedback.at(-1)?.nextCurrent).toBe(result.nextState.score);
    expect(plan.scoreFeedback.some((entry) => entry.completedThisMove)).toBe(true);
  });
});
