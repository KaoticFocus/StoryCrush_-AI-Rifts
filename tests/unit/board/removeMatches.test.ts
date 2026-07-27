import { describe, expect, it } from 'vitest';
import { BoardDomainError } from '../../../src/game/board/errors';
import { removeMatchedCoordinates } from '../../../src/game/board/removeMatches';
import { standardBoard, standardGrid } from './boardTestHelpers';

describe('removeMatchedCoordinates', () => {
  it('removes one horizontal match', () => {
    const board = standardBoard([
      ['ruby', 'ruby', 'ruby'],
      ['topaz', 'amethyst', 'pearl'],
    ]);

    const grid = removeMatchedCoordinates(board, [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
    ]);

    expect(grid).toEqual(
      standardGrid([
        [null, null, null],
        ['topaz', 'amethyst', 'pearl'],
      ]),
    );
  });

  it('removes one vertical match', () => {
    const board = standardBoard([
      ['ruby', 'sapphire'],
      ['ruby', 'topaz'],
      ['ruby', 'pearl'],
    ]);

    const grid = removeMatchedCoordinates(board, [
      { row: 0, column: 0 },
      { row: 1, column: 0 },
      { row: 2, column: 0 },
    ]);

    expect(grid).toEqual(
      standardGrid([
        [null, 'sapphire'],
        [null, 'topaz'],
        [null, 'pearl'],
      ]),
    );
  });

  it('removes multiple and intersecting matches with unique coordinate handling', () => {
    const board = standardBoard([
      ['topaz', 'ruby', 'emerald'],
      ['ruby', 'ruby', 'ruby'],
      ['amethyst', 'ruby', 'pearl'],
    ]);

    const grid = removeMatchedCoordinates(board, [
      { row: 1, column: 0 },
      { row: 1, column: 1 },
      { row: 1, column: 2 },
      { row: 0, column: 1 },
      { row: 1, column: 1 },
      { row: 2, column: 1 },
    ]);

    expect(grid).toEqual(
      standardGrid([
        ['topaz', null, 'emerald'],
        [null, null, null],
        ['amethyst', null, 'pearl'],
      ]),
    );
  });

  it('preserves dimensions and unmatched pieces', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['topaz', 'amethyst', 'pearl'],
    ]);

    const grid = removeMatchedCoordinates(board, [{ row: 1, column: 2 }]);

    expect(grid).toHaveLength(2);
    expect(grid[0]).toHaveLength(3);
    expect(grid[0][0]).toEqual(standardGrid([['ruby']])[0][0]);
    expect(grid[1][2]).toBeNull();
  });

  it('rejects out-of-bounds coordinates', () => {
    const board = standardBoard([
      ['ruby', 'sapphire'],
      ['topaz', 'amethyst'],
    ]);

    expect(() => removeMatchedCoordinates(board, [{ row: 2, column: 0 }])).toThrowError(
      BoardDomainError,
    );
  });

  it('does not mutate the source board or source grid', () => {
    const board = standardBoard([
      ['ruby', 'sapphire'],
      ['topaz', 'amethyst'],
    ]);

    const sourceGrid = standardGrid([
      ['ruby', 'sapphire'],
      ['topaz', 'amethyst'],
    ]);

    removeMatchedCoordinates(board, [{ row: 0, column: 0 }]);
    const fromGrid = removeMatchedCoordinates(sourceGrid, [{ row: 0, column: 1 }]);
    fromGrid[0][0] = null;

    expect(board.toGridSnapshot()).toEqual([
      standardGrid([
        ['ruby', 'sapphire'],
        ['topaz', 'amethyst'],
      ])[0],
      standardGrid([
        ['ruby', 'sapphire'],
        ['topaz', 'amethyst'],
      ])[1],
    ]);
    expect(sourceGrid).toEqual(
      standardGrid([
        ['ruby', 'sapphire'],
        ['topaz', 'amethyst'],
      ]),
    );
  });
});
