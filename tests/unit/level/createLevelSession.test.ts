import { describe, expect, it } from 'vitest';
import { BoardDomainError } from '../../../src/game/board/errors';
import { createPieceInventory } from '../../../src/game/board/pieceInventory';
import { createLevelSession } from '../../../src/game/level';
import type { LevelDefinition } from '../../../src/game/level';
import { standardBoard } from '../board/boardTestHelpers';

function makeDefinition(overrides?: Partial<LevelDefinition>): LevelDefinition {
  return {
    id: 'level-session',
    moveLimit: 8,
    allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
    objectives: [
      { id: 'score-main', kind: 'score' as const, targetScore: 100 },
      {
        id: 'collect-ruby',
        kind: 'collect-piece' as const,
        pieceType: 'ruby' as const,
        targetCount: 2,
      },
    ],
    scoring: {
      pointsPerRemovedPiece: 10,
      lineClearActivationBonus: 40,
      areaClearActivationBonus: 50,
      wildcardActivationBonus: 60,
      cascadeMultiplierIncrement: 1,
    },
    seed: 123,
    ...overrides,
  };
}

describe('createLevelSession', () => {
  it('creates an active session for playable stable board', () => {
    const definition = makeDefinition();
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby', 'ruby'],
      ['topaz', 'amethyst', 'pearl', 'emerald'],
    ]);

    const result = createLevelSession({ definition, initialBoard: board });

    expect(result.initialReshuffle).toBeUndefined();
    expect(result.state.status).toBe('active');
    expect(result.state.score).toBe(0);
    expect(result.state.movesRemaining).toBe(definition.moveLimit);
    expect(result.state.acceptedMoveCount).toBe(0);
  });

  it('reshuffles dead initial board and preserves inventory', () => {
    const definition = makeDefinition();
    const deadBoard = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['emerald', 'ruby', 'sapphire'],
      ['sapphire', 'emerald', 'ruby'],
    ]);

    const result = createLevelSession({ definition, initialBoard: deadBoard });

    expect(result.initialReshuffle).toBeDefined();
    expect(result.initialReshuffle?.validPlayableSwaps.length).toBeGreaterThan(0);
    expect(createPieceInventory(result.state.board)).toEqual(createPieceInventory(deadBoard));
  });

  it('rejects unstable initial boards', () => {
    const unstable = standardBoard([
      ['ruby', 'ruby', 'ruby'],
      ['topaz', 'amethyst', 'pearl'],
    ]);

    expect(() =>
      createLevelSession({
        definition: makeDefinition(),
        initialBoard: unstable,
      }),
    ).toThrowError(BoardDomainError);
  });

  it('fails explicitly when initial dead-board reshuffle is exhausted', () => {
    const deadUnsatisfiable = standardBoard([['ruby', 'sapphire', 'ruby', 'sapphire']]);

    expect(() =>
      createLevelSession({
        definition: makeDefinition({
          reshuffle: {
            maxRandomAttempts: 1,
            maxSearchNodes: 1,
          },
        }),
        initialBoard: deadUnsatisfiable,
      }),
    ).toThrowError(BoardDomainError);
  });
});
