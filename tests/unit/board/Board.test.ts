import { describe, expect, it } from 'vitest';
import { Board } from '../../../src/game/board/Board';
import { BoardDomainError } from '../../../src/game/board/errors';
import { standardBoard, standardPiece } from './boardTestHelpers';

describe('Board', () => {
  it('reports dimensions from the grid', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['topaz', 'amethyst', 'pearl'],
    ]);

    expect(board.getDimensions()).toEqual({ rows: 2, columns: 3 });
  });

  it('rejects malformed and invalid-dimension grids', () => {
    expect(() => Board.fromGrid([])).toThrowError(BoardDomainError);
    expect(() => Board.fromGrid([[]])).toThrowError(BoardDomainError);
    expect(() => Board.fromGrid([['ruby', 'sapphire'], ['topaz']])).toThrowError(BoardDomainError);
  });

  it('reads pieces by coordinate', () => {
    const board = standardBoard([
      ['ruby', 'sapphire'],
      ['emerald', 'topaz'],
    ]);

    expect(board.getPieceAt({ row: 0, column: 1 })).toEqual(standardPiece('sapphire'));
    expect(board.getPieceAt({ row: 1, column: 0 })).toEqual(standardPiece('emerald'));
  });

  it('checks coordinate bounds', () => {
    const board = standardBoard([
      ['ruby', 'sapphire'],
      ['emerald', 'topaz'],
    ]);

    expect(board.isWithinBounds({ row: 0, column: 0 })).toBe(true);
    expect(board.isWithinBounds({ row: 1, column: 1 })).toBe(true);
    expect(board.isWithinBounds({ row: -1, column: 0 })).toBe(false);
    expect(board.isWithinBounds({ row: 2, column: 0 })).toBe(false);
    expect(board.isWithinBounds({ row: 0, column: 2 })).toBe(false);
  });

  it('returns a defensive snapshot copy', () => {
    const board = standardBoard([
      ['ruby', 'sapphire'],
      ['emerald', 'topaz'],
    ]);

    const snapshot = board.toGridSnapshot();
    snapshot[0][0] = standardPiece('pearl');

    expect(board.getPieceAt({ row: 0, column: 0 })).toEqual(standardPiece('ruby'));
  });

  it('swaps two positions immutably', () => {
    const board = standardBoard([
      ['ruby', 'sapphire'],
      ['emerald', 'topaz'],
    ]);

    const swapped = board.swapPieces({ row: 0, column: 0 }, { row: 1, column: 1 });

    expect(swapped.toGridSnapshot()).toEqual([
      [standardPiece('topaz'), standardPiece('sapphire')],
      [standardPiece('emerald'), standardPiece('ruby')],
    ]);

    expect(board.toGridSnapshot()).toEqual([
      [standardPiece('ruby'), standardPiece('sapphire')],
      [standardPiece('emerald'), standardPiece('topaz')],
    ]);
  });

  it('rejects out-of-bounds coordinate lookups and same-coordinate swaps', () => {
    const board = standardBoard([
      ['ruby', 'sapphire'],
      ['emerald', 'topaz'],
    ]);

    expect(() => board.getPieceAt({ row: 9, column: 9 })).toThrowError(BoardDomainError);
    expect(() => board.swapPieces({ row: 0, column: 0 }, { row: 0, column: 0 })).toThrowError(
      BoardDomainError,
    );
  });
});
