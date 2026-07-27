import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../../../src/game/board/seededRandom';
import { refillBoard } from '../../../src/game/board/refillBoard';
import { BoardDomainError } from '../../../src/game/board/errors';
import { RandomSource } from '../../../src/game/board/boardTypes';
import { standardGrid, standardPiece } from './boardTestHelpers';

class ScriptedRandom implements RandomSource {
  private index = 0;

  public constructor(private readonly values: number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index] ?? 0;
    this.index += 1;
    return value % maxExclusive;
  }
}

describe('refillBoard', () => {
  it('fills every empty cell and preserves existing cells', () => {
    const grid = standardGrid([
      ['ruby', null, null],
      [null, 'sapphire', 'emerald'],
    ]);

    const result = refillBoard(
      grid,
      ['ruby', 'sapphire', 'emerald'],
      new ScriptedRandom([1, 2, 0]),
    );

    expect(result.board.toGridSnapshot()).toEqual([
      standardGrid([
        ['ruby', 'emerald', 'ruby'],
        ['sapphire', 'sapphire', 'emerald'],
      ])[0],
      standardGrid([
        ['ruby', 'emerald', 'ruby'],
        ['sapphire', 'sapphire', 'emerald'],
      ])[1],
    ]);
    expect(result.placements).toEqual([
      { coordinate: { row: 1, column: 0 }, piece: standardPiece('sapphire') },
      { coordinate: { row: 0, column: 1 }, piece: standardPiece('emerald') },
      { coordinate: { row: 0, column: 2 }, piece: standardPiece('ruby') },
    ]);
  });

  it('uses only allowed piece types', () => {
    const result = refillBoard(
      standardGrid([[null, null]]),
      ['ruby', 'sapphire'],
      new ScriptedRandom([0, 1]),
    );
    const snapshot = result.board.toGridSnapshot();

    expect(['ruby', 'sapphire']).toContain(snapshot[0][0].pieceType);
    expect(['ruby', 'sapphire']).toContain(snapshot[0][1].pieceType);
  });

  it('is deterministic for same grid and seed', () => {
    const grid = standardGrid([
      [null, 'ruby', null],
      ['sapphire', null, 'emerald'],
    ]);

    const first = refillBoard(grid, ['ruby', 'sapphire', 'emerald'], new SeededRandom(2026));
    const second = refillBoard(grid, ['ruby', 'sapphire', 'emerald'], new SeededRandom(2026));

    expect(first.board.toGridSnapshot()).toEqual(second.board.toGridSnapshot());
    expect(first.placements).toEqual(second.placements);
  });

  it('different seeds can produce different refills', () => {
    const grid = standardGrid([[null, null, null, null]]);

    const first = refillBoard(grid, ['ruby', 'sapphire', 'emerald'], new SeededRandom(1));
    const second = refillBoard(grid, ['ruby', 'sapphire', 'emerald'], new SeededRandom(2));

    expect(first.board.toGridSnapshot()).not.toEqual(second.board.toGridSnapshot());
  });

  it('returns no placements when grid has no empty cells', () => {
    const result = refillBoard(
      standardGrid([
        ['ruby', 'sapphire'],
        ['emerald', 'topaz'],
      ]),
      ['ruby', 'sapphire', 'emerald', 'topaz'],
      new ScriptedRandom([]),
    );

    expect(result.placements).toEqual([]);
  });

  it('rejects empty and invalid piece-type lists', () => {
    expect(() => refillBoard(standardGrid([[null]]), [], new ScriptedRandom([0]))).toThrowError(
      BoardDomainError,
    );
    expect(() =>
      refillBoard(standardGrid([[null]]), ['invalid-piece'], new ScriptedRandom([0])),
    ).toThrowError(BoardDomainError);
  });

  it('does not mutate the input grid', () => {
    const grid = standardGrid([[null, 'ruby']]);
    const before = grid.map((row) => [...row]);

    refillBoard(grid, ['ruby', 'sapphire'], new ScriptedRandom([1]));

    expect(grid).toEqual(before);
  });
});
