import { describe, expect, it } from 'vitest';
import { findMatchRuns } from '../../../src/game/board/matchDetection';
import { resolveCascade } from '../../../src/game/board/resolveCascade';
import { BoardDomainError } from '../../../src/game/board/errors';
import { RandomSource } from '../../../src/game/board/boardTypes';
import { standardPiece, standardBoard } from './boardTestHelpers';

class ScriptedRandom implements RandomSource {
  private index = 0;

  public constructor(private readonly values: number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index] ?? 0;
    this.index += 1;
    return value % maxExclusive;
  }
}

describe('resolveCascade', () => {
  it('resolves an accepted scoring swap with one cascade step', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);

    const result = resolveCascade({
      board,
      first: { row: 0, column: 1 },
      second: { row: 1, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      randomSource: new ScriptedRandom([0, 1, 2]),
    });

    expect(result.isValid).toBe(true);
    if (!result.isValid) {
      return;
    }

    expect(result.cascadeCount).toBe(1);
    expect(result.steps[0].index).toBe(0);
    expect(result.steps[0].removedCoordinates).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
    ]);
    expect(findMatchRuns(result.finalBoard).runs).toHaveLength(0);
  });

  it('resolves cascades created by refill and records step history', () => {
    const board = standardBoard([['ruby', 'sapphire', 'ruby', 'ruby']]);

    const result = resolveCascade({
      board,
      first: { row: 0, column: 0 },
      second: { row: 0, column: 1 },
      pieceTypes: ['sapphire', 'ruby'],
      randomSource: new ScriptedRandom([0, 0, 0, 1, 0, 1, 0]),
    });

    expect(result.isValid).toBe(true);
    if (!result.isValid) {
      return;
    }

    expect(result.cascadeCount).toBe(2);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].matches.runs).toHaveLength(1);
    expect(result.steps[1].matches.runs).toHaveLength(1);
    expect(result.steps[0].refillPlacements).toEqual([
      { coordinate: { row: 0, column: 1 }, piece: standardPiece('sapphire') },
      { coordinate: { row: 0, column: 2 }, piece: standardPiece('sapphire') },
      { coordinate: { row: 0, column: 3 }, piece: standardPiece('sapphire') },
    ]);
    expect(findMatchRuns(result.finalBoard).runs).toHaveLength(0);
  });

  it('rejects structurally invalid swaps without resolving', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);

    const result = resolveCascade({
      board,
      first: { row: 0, column: 0 },
      second: { row: 2, column: 2 },
      pieceTypes: ['ruby', 'sapphire', 'emerald'],
      seed: 1,
    });

    expect(result.isValid).toBe(false);
    if (result.isValid) {
      return;
    }

    expect(result.reason).toBe('structurally-invalid');
    expect(result.finalBoard.toGridSnapshot()).toEqual(board.toGridSnapshot());
  });

  it('rejects adjacent non-scoring swaps without resolving', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);

    const result = resolveCascade({
      board,
      first: { row: 0, column: 0 },
      second: { row: 0, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald'],
      seed: 1,
    });

    expect(result.isValid).toBe(false);
    if (result.isValid) {
      return;
    }

    expect(result.reason).toBe('no-match-created');
    expect(result.finalBoard.toGridSnapshot()).toEqual(board.toGridSnapshot());
  });

  it('enforces cascade safety limit', () => {
    const board = standardBoard([['ruby', 'sapphire', 'ruby', 'ruby']]);

    expect(() =>
      resolveCascade({
        board,
        first: { row: 0, column: 0 },
        second: { row: 0, column: 1 },
        pieceTypes: ['sapphire', 'ruby'],
        randomSource: new ScriptedRandom([0, 0, 0, 0]),
        maxCascadeSteps: 1,
      }),
    ).toThrowError(BoardDomainError);
  });

  it('rejects invalid cascade limits', () => {
    const board = standardBoard([['ruby', 'sapphire', 'ruby', 'ruby']]);

    expect(() =>
      resolveCascade({
        board,
        first: { row: 0, column: 0 },
        second: { row: 0, column: 1 },
        pieceTypes: ['sapphire', 'ruby'],
        seed: 10,
        maxCascadeSteps: 0,
      }),
    ).toThrowError(BoardDomainError);
  });

  it('is deterministic for same input and seed and keeps source board unchanged', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);

    const before = board.toGridSnapshot();

    const first = resolveCascade({
      board,
      first: { row: 0, column: 1 },
      second: { row: 1, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      seed: 123,
    });

    const second = resolveCascade({
      board,
      first: { row: 0, column: 1 },
      second: { row: 1, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      seed: 123,
    });

    expect(board.toGridSnapshot()).toEqual(before);
    expect(first).toEqual(second);
  });

  it('returns defensively isolated history arrays', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);

    const result = resolveCascade({
      board,
      first: { row: 0, column: 1 },
      second: { row: 1, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      randomSource: new ScriptedRandom([0, 1, 2]),
    });

    expect(result.isValid).toBe(true);
    if (!result.isValid) {
      return;
    }

    const mutatedCoordinates = result.steps[0].removedCoordinates;
    mutatedCoordinates[0].row = 99;

    const rerun = resolveCascade({
      board,
      first: { row: 0, column: 1 },
      second: { row: 1, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      randomSource: new ScriptedRandom([0, 1, 2]),
    });

    expect(rerun.isValid).toBe(true);
    if (!rerun.isValid) {
      return;
    }

    expect(rerun.steps[0].removedCoordinates[0]).toEqual({ row: 0, column: 0 });
  });
});
