import { describe, expect, it } from 'vitest';
import { validateScoringSwap } from '../../../src/game/board/swapValidation';
import {
  countPlayableSwaps,
  findPlayableSwaps,
  countValidScoringSwaps,
  findValidScoringSwaps,
  hasPlayableSwap,
  hasValidScoringSwap,
} from '../../../src/game/board/validMoves';
import {
  areaClearPiece,
  boardFromPieces,
  lineClearPiece,
  standardBoard,
  standardPiece,
  wildcardPiece,
} from './boardTestHelpers';

describe('valid move enumeration', () => {
  it('returns no moves for a dead board', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['emerald', 'ruby', 'sapphire'],
      ['sapphire', 'emerald', 'ruby'],
    ]);

    expect(findValidScoringSwaps(board)).toEqual([]);
    expect(hasValidScoringSwap(board)).toBe(false);
    expect(countValidScoringSwaps(board)).toBe(0);
  });

  it('returns exactly one move when one exists', () => {
    const board = standardBoard([['ruby', 'sapphire', 'ruby', 'ruby']]);

    const moves = findValidScoringSwaps(board);
    expect(moves).toEqual([{ from: { row: 0, column: 0 }, to: { row: 0, column: 1 } }]);
  });

  it('returns multiple deterministic moves without reversed duplicates', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby', 'sapphire'],
      ['sapphire', 'ruby', 'sapphire', 'ruby'],
      ['ruby', 'sapphire', 'ruby', 'sapphire'],
      ['sapphire', 'ruby', 'sapphire', 'ruby'],
    ]);

    const first = findValidScoringSwaps(board);
    const second = findValidScoringSwaps(board);

    expect(first).toEqual(second);

    const keys = new Set(
      first.map((move) => `${move.from.row},${move.from.column}->${move.to.row},${move.to.column}`),
    );
    expect(keys.size).toBe(first.length);

    for (const move of first) {
      const reverse = `${move.to.row},${move.to.column}->${move.from.row},${move.from.column}`;
      expect(keys.has(reverse)).toBe(false);
    }
  });

  it('supports single-row and single-column boards', () => {
    const rowBoard = standardBoard([['ruby', 'sapphire', 'ruby', 'ruby']]);
    const columnBoard = standardBoard([['ruby'], ['sapphire'], ['ruby'], ['ruby']]);

    expect(findValidScoringSwaps(rowBoard)).toHaveLength(1);
    expect(findValidScoringSwaps(columnBoard)).toHaveLength(1);
  });

  it('returns only swaps that pass existing scoring validation', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);

    const before = board.toGridSnapshot();
    const moves = findValidScoringSwaps(board);

    for (const move of moves) {
      expect(validateScoringSwap(board, move.from, move.to).isValid).toBe(true);
    }

    expect(board.toGridSnapshot()).toEqual(before);
  });

  it('helper methods reflect enumeration and do not mutate board', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);
    const before = board.toGridSnapshot();

    const moves = findValidScoringSwaps(board);
    expect(hasValidScoringSwap(board)).toBe(true);
    expect(countValidScoringSwaps(board)).toBe(moves.length);
    expect(board.toGridSnapshot()).toEqual(before);
  });

  it('includes wildcard and special-combination playable swaps', () => {
    const wildcardBoard = boardFromPieces([
      [wildcardPiece('ruby'), standardPiece('sapphire')],
      [standardPiece('emerald'), standardPiece('topaz')],
    ]);

    const wildcardMoves = findPlayableSwaps(wildcardBoard);
    expect(wildcardMoves).toEqual([
      {
        from: { row: 0, column: 0 },
        to: { row: 0, column: 1 },
        kind: 'wildcard-swap',
      },
      {
        from: { row: 0, column: 0 },
        to: { row: 1, column: 0 },
        kind: 'wildcard-swap',
      },
    ]);

    const specialBoard = boardFromPieces([
      [lineClearPiece('ruby', 'horizontal'), areaClearPiece('topaz')],
      [standardPiece('emerald'), standardPiece('amethyst')],
    ]);

    const specialMoves = findPlayableSwaps(specialBoard);
    expect(specialMoves[0]).toEqual({
      from: { row: 0, column: 0 },
      to: { row: 0, column: 1 },
      kind: 'special-combination',
    });
    expect(hasPlayableSwap(specialBoard)).toBe(true);
    expect(countPlayableSwaps(specialBoard)).toBe(specialMoves.length);
  });
});
