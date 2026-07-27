import { describe, expect, it } from 'vitest';
import { BoardDomainError } from '../../../src/game/board/errors';
import { applyLevelMove, createLevelSession } from '../../../src/game/level';
import type { LevelDefinition } from '../../../src/game/level';
import { standardBoard } from '../board/boardTestHelpers';

function baseDefinition(overrides?: Partial<LevelDefinition>): LevelDefinition {
  return {
    id: 'level-move',
    moveLimit: 3,
    allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
    objectives: [
      { id: 'score-main', kind: 'score' as const, targetScore: 90 },
      {
        id: 'collect-ruby',
        kind: 'collect-piece' as const,
        pieceType: 'ruby' as const,
        targetCount: 3,
      },
    ],
    scoring: {
      pointsPerRemovedPiece: 10,
      lineClearActivationBonus: 40,
      areaClearActivationBonus: 50,
      wildcardActivationBonus: 60,
      cascadeMultiplierIncrement: 1,
    },
    seed: 321,
    ...(overrides ?? {}),
  };
}

function createPlayableState() {
  return createLevelSession({
    definition: baseDefinition(),
    initialBoard: standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]),
  }).state;
}

describe('applyLevelMove', () => {
  it('accepted move consumes one move, increments accepted count, and returns score/objective events', () => {
    const definition = baseDefinition();
    const state = createPlayableState();

    const result = applyLevelMove({
      definition,
      state,
      from: { row: 0, column: 1 },
      to: { row: 1, column: 1 },
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }

    expect(result.movesConsumed).toBe(1);
    expect(result.movesBefore - result.movesAfter).toBe(1);
    expect(result.nextState.acceptedMoveCount).toBe(state.acceptedMoveCount + 1);
    expect(result.scoreAfter).toBeGreaterThan(result.scoreBefore);
    expect(result.scoreCalculation.totalAwardedPoints).toBeGreaterThan(0);
    expect(result.collectionEvents.length).toBeGreaterThan(0);
    expect(result.objectiveUpdates.length).toBe(definition.objectives.length);
  });

  it('rejected non-scoring standard move consumes zero and preserves state', () => {
    const definition = baseDefinition();
    const state = createPlayableState();

    const result = applyLevelMove({
      definition,
      state,
      from: { row: 2, column: 1 },
      to: { row: 2, column: 2 },
    });

    expect(result.accepted).toBe(false);
    if (result.accepted) {
      throw new Error('expected rejected move result');
    }

    expect(result.kind).toBe('rejected');
    expect(result.movesConsumed).toBe(0);
    expect(result.state.score).toBe(state.score);
    expect(result.state.movesRemaining).toBe(state.movesRemaining);
    expect(result.state.acceptedMoveCount).toBe(state.acceptedMoveCount);
  });

  it('terminal won/failed states reject further moves without consuming', () => {
    const state = createPlayableState();

    const wonState = {
      ...state,
      status: 'won' as const,
    };

    const wonResult = applyLevelMove({
      definition: baseDefinition(),
      state: wonState,
      from: { row: 0, column: 0 },
      to: { row: 0, column: 1 },
    });

    expect(wonResult.accepted).toBe(false);
    if (wonResult.accepted) {
      throw new Error('expected terminal move result');
    }

    expect(wonResult.kind).toBe('terminal');
    expect(wonResult.movesConsumed).toBe(0);

    const failedState = {
      ...state,
      status: 'failed' as const,
    };

    const failedResult = applyLevelMove({
      definition: baseDefinition(),
      state: failedState,
      from: { row: 0, column: 0 },
      to: { row: 0, column: 1 },
    });

    expect(failedResult.accepted).toBe(false);
    if (failedResult.accepted) {
      throw new Error('expected terminal move result');
    }

    expect(failedResult.kind).toBe('terminal');
    expect(failedResult.movesConsumed).toBe(0);
  });

  it('wins when final objective completes, including on last available move', () => {
    const definition = baseDefinition({
      moveLimit: 1,
      objectives: [{ id: 'score-main', kind: 'score', targetScore: 30 }],
    });

    const initial = createLevelSession({
      definition,
      initialBoard: standardBoard([
        ['ruby', 'sapphire', 'ruby'],
        ['topaz', 'ruby', 'emerald'],
        ['amethyst', 'pearl', 'topaz'],
      ]),
    }).state;

    const result = applyLevelMove({
      definition,
      state: initial,
      from: { row: 0, column: 1 },
      to: { row: 1, column: 1 },
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }

    expect(result.nextStatus).toBe('won');
    expect(result.movesAfter).toBe(0);
    expect(result.reshuffle).toBeUndefined();
  });

  it('fails when moves reach zero and objectives remain incomplete', () => {
    const definition = baseDefinition({
      moveLimit: 1,
      objectives: [{ id: 'score-main', kind: 'score', targetScore: 1000 }],
    });

    const state = createLevelSession({
      definition,
      initialBoard: standardBoard([
        ['ruby', 'sapphire', 'ruby'],
        ['topaz', 'ruby', 'emerald'],
        ['amethyst', 'pearl', 'topaz'],
      ]),
    }).state;

    const result = applyLevelMove({
      definition,
      state,
      from: { row: 0, column: 1 },
      to: { row: 1, column: 1 },
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }

    expect(result.nextStatus).toBe('failed');
    expect(result.movesAfter).toBe(0);
    expect(result.reshuffle).toBeUndefined();
  });

  it('fails transactionally on cascade limit overflow', () => {
    const definition = baseDefinition({
      moveLimit: 3,
      maxCascadeSteps: 1,
      allowedRefillPieceTypes: ['sapphire', 'ruby'],
    });

    const state = createLevelSession({
      definition,
      initialBoard: standardBoard([['ruby', 'sapphire', 'ruby', 'ruby']]),
    }).state;

    const before = {
      score: state.score,
      movesRemaining: state.movesRemaining,
      acceptedMoveCount: state.acceptedMoveCount,
      status: state.status,
    };

    expect(() =>
      applyLevelMove({
        definition,
        state,
        from: { row: 0, column: 0 },
        to: { row: 0, column: 1 },
      }),
    ).toThrowError(BoardDomainError);

    expect(state.score).toBe(before.score);
    expect(state.movesRemaining).toBe(before.movesRemaining);
    expect(state.acceptedMoveCount).toBe(before.acceptedMoveCount);
    expect(state.status).toBe(before.status);
  });

  it('fails transactionally when post-move dead-board reshuffle is exhausted', () => {
    const definition = baseDefinition({
      seed: 1,
      moveLimit: 5,
      allowedRefillPieceTypes: ['ruby', 'sapphire'],
      objectives: [{ id: 'score-main', kind: 'score', targetScore: 9999 }],
    });

    const state = createLevelSession({
      definition,
      initialBoard: standardBoard([['ruby', 'sapphire', 'ruby', 'ruby']]),
    }).state;

    const before = {
      score: state.score,
      movesRemaining: state.movesRemaining,
      acceptedMoveCount: state.acceptedMoveCount,
      status: state.status,
    };

    expect(() =>
      applyLevelMove({
        definition,
        state,
        from: { row: 0, column: 0 },
        to: { row: 0, column: 1 },
      }),
    ).toThrowError(BoardDomainError);

    expect(state.score).toBe(before.score);
    expect(state.movesRemaining).toBe(before.movesRemaining);
    expect(state.acceptedMoveCount).toBe(before.acceptedMoveCount);
    expect(state.status).toBe(before.status);
  });
});
