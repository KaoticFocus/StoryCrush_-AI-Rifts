import { describe, expect, it } from 'vitest';
import { resolveCascade, validatePlayableSwap, type Board } from '../../../src/game/board';
import {
  type AcceptedLevelMoveResult,
  DEFAULT_SCORING_RULES,
  calculateResolutionScore,
  type LevelDefinition,
  type LevelSessionState,
} from '../../../src/game/level';
import { buildScorePresentationPlan } from '../../../src/game/presentation/playback/scorePresentationPlanning';
import {
  boardFromPieces,
  lineClearPiece,
  standardPiece,
  wildcardPiece,
} from '../board/boardTestHelpers';

class ScriptedRandom {
  private index = 0;

  public constructor(private readonly values: number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index] ?? 0;
    this.index += 1;
    return value % maxExclusive;
  }
}

function createDefinition(overrides?: Partial<LevelDefinition>): LevelDefinition {
  return {
    id: 'score-feedback',
    moveLimit: 5,
    allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
    objectives: [{ id: 'score-main', kind: 'score', targetScore: 1000 }],
    scoring: DEFAULT_SCORING_RULES,
    seed: 14,
    ...(overrides ?? {}),
  };
}

function createState(board: Board, definition: LevelDefinition): LevelSessionState {
  return {
    levelId: definition.id,
    baseSeed: definition.seed,
    board,
    score: 10,
    movesRemaining: definition.moveLimit,
    acceptedMoveCount: 0,
    status: 'active',
    objectiveProgress: [
      { objectiveId: 'score-main', kind: 'score', current: 10, target: 1000, complete: false },
    ],
  };
}

function createAcceptedMoveResult(): AcceptedLevelMoveResult {
  const definition = createDefinition();
  const board = boardFromPieces([
    [wildcardPiece('ruby'), lineClearPiece('sapphire', 'vertical')],
    [lineClearPiece('sapphire', 'horizontal'), standardPiece('topaz')],
  ]);
  const from = { row: 0, column: 0 };
  const to = { row: 0, column: 1 };
  const resolution = resolveCascade({
    board,
    first: from,
    second: to,
    pieceTypes: definition.allowedRefillPieceTypes,
    randomSource: new ScriptedRandom([0, 1, 2, 3]),
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
  const nextState: LevelSessionState = {
    ...previousState,
    board: resolution.finalBoard,
    score: previousState.score + scoreCalculation.totalAwardedPoints,
    movesRemaining: previousState.movesRemaining - 1,
    acceptedMoveCount: 1,
    objectiveProgress: [
      {
        objectiveId: 'score-main',
        kind: 'score',
        current: previousState.score + scoreCalculation.totalAwardedPoints,
        target: 1000,
        complete: false,
      },
    ],
  };

  return {
    accepted: true,
    requestedSwap: { from, to },
    moveKind: playableSwap.kind,
    previousState,
    nextState,
    previousStatus: 'active',
    nextStatus: 'active',
    scoreBefore: previousState.score,
    scoreAfter: nextState.score,
    movesBefore: previousState.movesRemaining,
    movesAfter: nextState.movesRemaining,
    movesConsumed: 1,
    resolutionSeed: definition.seed,
    resolution,
    scoreCalculation,
    collectionEvents: [],
    objectiveUpdates: [],
  };
}

describe('buildScorePresentationPlan', () => {
  it('preserves score event ordering and cumulative totals', () => {
    const result = createAcceptedMoveResult();
    const plan = buildScorePresentationPlan(result);

    expect(plan.entries.map((entry) => entry.event.kind)).toEqual(
      result.scoreCalculation.events.map((event) => event.kind),
    );
    expect(plan.entries.at(-1)?.cumulativeScoreAfter).toBe(result.scoreAfter);
    expect(plan.entries[0].label.startsWith('+')).toBe(true);
  });

  it('creates match and special labels without mutating source score events', () => {
    const result = createAcceptedMoveResult();
    const before = JSON.parse(JSON.stringify(result.scoreCalculation.events));

    const plan = buildScorePresentationPlan(result);

    expect(plan.entries.some((entry) => entry.label.includes('Match'))).toBe(true);
    expect(plan.entries.some((entry) => entry.label.includes('Wildcard'))).toBe(true);
    expect(JSON.parse(JSON.stringify(result.scoreCalculation.events))).toEqual(before);
  });
});
