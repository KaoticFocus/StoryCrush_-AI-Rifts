import { describe, expect, it } from 'vitest';
import { resolveCascade, validatePlayableSwap, type Board } from '../../../src/game/board';
import {
  type AcceptedLevelMoveResult,
  DEFAULT_SCORING_RULES,
  calculateResolutionScore,
  type LevelDefinition,
  type LevelSessionState,
} from '../../../src/game/level';
import { buildMovePlaybackPlan } from '../../../src/game/presentation/playback/buildMovePlaybackPlan';
import {
  boardFromPieces,
  lineClearPiece,
  standardBoard,
  standardPiece,
  wildcardPiece,
} from '../board/boardTestHelpers';

function createDefinition(overrides?: Partial<LevelDefinition>): LevelDefinition {
  return {
    id: 'playback-level',
    moveLimit: 5,
    allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
    objectives: [{ id: 'score-main', kind: 'score', targetScore: 1000 }],
    scoring: {
      pointsPerRemovedPiece: 10,
      lineClearActivationBonus: 40,
      crossClearActivationBonus: 50,
      wildcardActivationBonus: 60,
      cascadeMultiplierIncrement: 1,
    },
    seed: 10,
    ...(overrides ?? {}),
  };
}

class ScriptedRandom {
  private index = 0;

  public constructor(private readonly values: number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index] ?? 0;
    this.index += 1;
    return value % maxExclusive;
  }
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
      {
        objectiveId: 'score-main',
        kind: 'score',
        current: 0,
        target: 1000,
        complete: false,
      },
    ],
  };
}

function createAcceptedMoveResult(input: {
  board: Board;
  definition?: LevelDefinition;
  from: { row: number; column: number };
  to: { row: number; column: number };
  randomValues: number[];
}): AcceptedLevelMoveResult {
  const definition = input.definition ?? createDefinition();
  const resolution = resolveCascade({
    board: input.board,
    first: input.from,
    second: input.to,
    pieceTypes: definition.allowedRefillPieceTypes,
    randomSource: new ScriptedRandom(input.randomValues),
  });

  expect(resolution.isValid).toBe(true);
  if (!resolution.isValid) {
    throw new Error('Expected accepted cascade resolution');
  }

  const playableSwap = validatePlayableSwap(input.board, input.from, input.to);
  expect(playableSwap.isValid).toBe(true);
  if (!playableSwap.isValid || !playableSwap.kind) {
    throw new Error('Expected valid playable swap kind');
  }

  const previousState = createState(input.board, definition);
  const scoreCalculation = calculateResolutionScore({
    resolution,
    rules: DEFAULT_SCORING_RULES,
  });
  const nextState: LevelSessionState = {
    ...previousState,
    board: resolution.finalBoard,
    score: scoreCalculation.totalAwardedPoints,
    movesRemaining: previousState.movesRemaining - 1,
    acceptedMoveCount: 1,
    objectiveProgress: [
      {
        objectiveId: 'score-main',
        kind: 'score',
        current: scoreCalculation.totalAwardedPoints,
        target: 1000,
        complete: false,
      },
    ],
  };

  return {
    accepted: true,
    requestedSwap: {
      from: { ...input.from },
      to: { ...input.to },
    },
    moveKind: playableSwap.kind,
    previousState,
    nextState,
    previousStatus: 'active',
    nextStatus: 'active',
    scoreBefore: 0,
    scoreAfter: scoreCalculation.totalAwardedPoints,
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

describe('buildMovePlaybackPlan', () => {
  it('starts with swap, keeps cascades sequential, and ends with synchronize', () => {
    const definition = createDefinition({
      allowedRefillPieceTypes: ['sapphire', 'ruby'],
    });
    const result = createAcceptedMoveResult({
      definition,
      board: standardBoard([['ruby', 'sapphire', 'ruby', 'ruby']]),
      from: { row: 0, column: 0 },
      to: { row: 0, column: 1 },
      randomValues: [0, 0, 0, 1, 0, 1, 0],
    });

    const plan = buildMovePlaybackPlan(result, definition.objectives);
    const kinds = plan.commands.map((command) => command.kind);

    expect(kinds[0]).toBe('swap');
    expect(kinds).toContain('highlight-matches');
    expect(kinds).toContain('remove-pieces');
    expect(kinds).toContain('apply-gravity');
    expect(kinds).toContain('refill-pieces');
    expect(kinds.at(-1)).toBe('synchronize-board');
    expect(kinds).toContain('cascade-pause');
    expect(plan.summary.cascadeCount).toBe(2);
  });

  it('preserves activation ordering and special-creation metadata', () => {
    const result = createAcceptedMoveResult({
      definition: createDefinition(),
      board: boardFromPieces([
        [wildcardPiece('ruby'), lineClearPiece('sapphire', 'vertical')],
        [lineClearPiece('sapphire', 'horizontal'), standardPiece('topaz')],
      ]),
      from: { row: 0, column: 0 },
      to: { row: 0, column: 1 },
      randomValues: [0, 1, 2, 3],
    });

    const plan = buildMovePlaybackPlan(result, createDefinition().objectives);
    const activationCommands = plan.commands.filter(
      (command) => command.kind === 'special-activation',
    );

    expect(activationCommands.map((command) => command.activation.index)).toEqual(
      activationCommands.map((_, index) => index),
    );
    expect(activationCommands.length).toBeGreaterThanOrEqual(2);
  });

  it('preserves special-creation metadata from protected coordinates', () => {
    const result = createAcceptedMoveResult({
      definition: createDefinition(),
      board: standardBoard([
        ['ruby', 'ruby', 'sapphire', 'ruby'],
        ['topaz', 'amethyst', 'ruby', 'emerald'],
      ]),
      from: { row: 0, column: 2 },
      to: { row: 1, column: 2 },
      randomValues: [0, 1, 2],
    });

    const plan = buildMovePlaybackPlan(result, createDefinition().objectives);
    const creationCommand = plan.commands.find((command) => command.kind === 'create-specials');

    expect(creationCommand?.kind).toBe('create-specials');
    if (creationCommand?.kind === 'create-specials') {
      expect(creationCommand.createdSpecialPieces).toHaveLength(1);
      expect(creationCommand.createdSpecialPieces[0].coordinate).toEqual({ row: 0, column: 2 });
      expect(creationCommand.createdSpecialPieces[0].piece.kind).toBe('line-clear');
    }
  });

  it('is deterministic, serializable, and does not mutate the accepted move result', () => {
    const result = createAcceptedMoveResult({
      definition: createDefinition(),
      board: standardBoard([
        ['ruby', 'sapphire', 'ruby'],
        ['topaz', 'ruby', 'emerald'],
        ['amethyst', 'pearl', 'topaz'],
      ]),
      from: { row: 0, column: 1 },
      to: { row: 1, column: 1 },
      randomValues: [0, 1, 2],
    });

    const before = result.previousState.board.toGridSnapshot();
    const firstPlan = buildMovePlaybackPlan(result, createDefinition().objectives);
    const secondPlan = buildMovePlaybackPlan(result, createDefinition().objectives);

    expect(firstPlan).toEqual(secondPlan);
    expect(JSON.parse(JSON.stringify(firstPlan))).toEqual(firstPlan);
    expect(result.previousState.board.toGridSnapshot()).toEqual(before);
  });
});
