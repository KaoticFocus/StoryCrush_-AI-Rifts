import { describe, expect, it } from 'vitest';
import { RandomSource } from '../../../src/game/board/boardTypes';
import { isDeadBoard } from '../../../src/game/board/deadBoard';
import { BoardDomainError } from '../../../src/game/board/errors';
import { findMatchRuns } from '../../../src/game/board/matchDetection';
import { createPieceInventory } from '../../../src/game/board/pieceInventory';
import { reshuffleDeadBoard } from '../../../src/game/board/reshuffleBoard';
import { standardBoard } from './boardTestHelpers';

class ScriptedRandom implements RandomSource {
  private index = 0;

  public constructor(private readonly values: number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index] ?? 0;
    this.index += 1;
    return value % maxExclusive;
  }
}

class MaxIndexRandom implements RandomSource {
  public nextInt(maxExclusive: number): number {
    return maxExclusive - 1;
  }
}

describe('reshuffleDeadBoard', () => {
  it('reshuffles a known dead board into a playable stable board with preserved inventory', () => {
    const deadBoard = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['emerald', 'ruby', 'sapphire'],
      ['sapphire', 'emerald', 'ruby'],
    ]);

    expect(isDeadBoard(deadBoard)).toBe(true);

    const result = reshuffleDeadBoard({
      board: deadBoard,
      seed: 12345,
      maxRandomAttempts: 100,
      maxSearchNodes: 50000,
    });

    expect(result.reshuffledBoard.getDimensions()).toEqual(deadBoard.getDimensions());
    expect(result.originalInventory).toEqual(createPieceInventory(deadBoard));
    expect(result.reshuffledInventory).toEqual(createPieceInventory(result.reshuffledBoard));
    expect(result.originalInventory).toEqual(result.reshuffledInventory);
    expect(findMatchRuns(result.reshuffledBoard).runs).toHaveLength(0);
    expect(result.validScoringSwaps.length).toBeGreaterThan(0);
    expect(result.validPlayableSwaps.length).toBeGreaterThan(0);
    expect(result.originalBoard.toGridSnapshot()).toEqual(deadBoard.toGridSnapshot());
  });

  it('is deterministic for same board and seed', () => {
    const deadBoard = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['emerald', 'ruby', 'sapphire'],
      ['sapphire', 'emerald', 'ruby'],
    ]);

    const first = reshuffleDeadBoard({
      board: deadBoard,
      seed: 9,
      maxRandomAttempts: 50,
      maxSearchNodes: 25000,
    });
    const second = reshuffleDeadBoard({
      board: deadBoard,
      seed: 9,
      maxRandomAttempts: 50,
      maxSearchNodes: 25000,
    });

    expect(first.reshuffledBoard.toGridSnapshot()).toEqual(second.reshuffledBoard.toGridSnapshot());
    expect(first.validScoringSwaps).toEqual(second.validScoringSwaps);
    expect(first.randomAttempts).toBe(second.randomAttempts);
    expect(first.fallbackSearchUsed).toBe(second.fallbackSearchUsed);
  });

  it('uses fallback search when random attempts are exhausted and can still succeed', () => {
    const deadBoard = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['emerald', 'ruby', 'sapphire'],
      ['sapphire', 'emerald', 'ruby'],
    ]);

    const result = reshuffleDeadBoard({
      board: deadBoard,
      randomSource: new MaxIndexRandom(),
      maxRandomAttempts: 1,
      maxSearchNodes: 50000,
    });

    expect(result.randomAttempts).toBe(1);
    expect(result.fallbackSearchUsed).toBe(true);
    expect(result.searchNodesVisited).toBeGreaterThan(0);
    expect(result.validScoringSwaps.length).toBeGreaterThan(0);
  });

  it('rejects already playable boards', () => {
    const playable = standardBoard([['ruby', 'sapphire', 'ruby']]);

    expect(() =>
      reshuffleDeadBoard({
        board: playable,
        seed: 1,
      }),
    ).toThrowError(BoardDomainError);
  });

  it('rejects unstable boards and invalid seed/limits', () => {
    const unstable = standardBoard([
      ['ruby', 'ruby', 'ruby'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);

    expect(() =>
      reshuffleDeadBoard({
        board: unstable,
        seed: 1,
      }),
    ).toThrowError(BoardDomainError);

    const deadBoard = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['emerald', 'ruby', 'sapphire'],
      ['sapphire', 'emerald', 'ruby'],
    ]);

    expect(() =>
      reshuffleDeadBoard({
        board: deadBoard,
        seed: Number.NaN,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      reshuffleDeadBoard({
        board: deadBoard,
        seed: 1,
        maxRandomAttempts: 0,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      reshuffleDeadBoard({
        board: deadBoard,
        seed: 1,
        maxRandomAttempts: -2,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      reshuffleDeadBoard({
        board: deadBoard,
        seed: 1,
        maxSearchNodes: 3.5,
      }),
    ).toThrowError(BoardDomainError);
  });

  it('fails explicitly on search exhaustion for unsatisfiable piece distributions', () => {
    const deadAndUnsatisfiable = standardBoard([['ruby', 'sapphire', 'ruby', 'sapphire']]);
    expect(isDeadBoard(deadAndUnsatisfiable)).toBe(true);

    expect(() =>
      reshuffleDeadBoard({
        board: deadAndUnsatisfiable,
        randomSource: new ScriptedRandom([0, 0, 0, 0, 0]),
        maxRandomAttempts: 2,
        maxSearchNodes: 20,
      }),
    ).toThrowError(BoardDomainError);
  });

  it('does not mutate the original board on success or failure', () => {
    const deadBoard = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['emerald', 'ruby', 'sapphire'],
      ['sapphire', 'emerald', 'ruby'],
    ]);
    const before = deadBoard.toGridSnapshot();

    reshuffleDeadBoard({
      board: deadBoard,
      seed: 15,
      maxRandomAttempts: 30,
      maxSearchNodes: 50000,
    });

    expect(deadBoard.toGridSnapshot()).toEqual(before);

    const unsatisfiable = standardBoard([['ruby', 'sapphire', 'ruby', 'sapphire']]);
    const unsBefore = unsatisfiable.toGridSnapshot();

    expect(() =>
      reshuffleDeadBoard({
        board: unsatisfiable,
        randomSource: new ScriptedRandom([0, 0, 0, 0]),
        maxRandomAttempts: 1,
        maxSearchNodes: 10,
      }),
    ).toThrowError(BoardDomainError);

    expect(unsatisfiable.toGridSnapshot()).toEqual(unsBefore);
  });
});
