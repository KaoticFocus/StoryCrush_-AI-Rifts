import { describe, expect, it } from 'vitest';
import { Board } from '../../../src/game/board/Board';
import { validatePlayableSwap } from '../../../src/game/board/playableSwapValidation';
import {
  areaClearPiece,
  lineClearPiece,
  standardPiece,
  standardBoard,
  wildcardPiece,
} from './boardTestHelpers';

describe('validatePlayableSwap', () => {
  it('accepts ordinary scoring swaps with ordinary-match kind', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);

    const result = validatePlayableSwap(board, { row: 0, column: 1 }, { row: 1, column: 1 });
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.kind).toBe('ordinary-match');
      expect(result.directActivationTriggers).toEqual([]);
    }
  });

  it('rejects non-scoring standard swaps', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);

    const result = validatePlayableSwap(board, { row: 0, column: 0 }, { row: 0, column: 1 });
    expect(result).toMatchObject({ isValid: false, reason: 'no-match-created' });
  });

  it('accepts wildcard plus standard without ordinary match', () => {
    const board = Board.fromGrid([
      [wildcardPiece('ruby'), standardPiece('sapphire')],
      [standardPiece('emerald'), standardPiece('topaz')],
    ]);

    const result = validatePlayableSwap(board, { row: 0, column: 0 }, { row: 0, column: 1 });
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.kind).toBe('wildcard-swap');
      expect(result.directActivationTriggers?.[0]).toMatchObject({
        coordinate: { row: 0, column: 1 },
        reason: 'direct-swap',
        wildcardTarget: { mode: 'piece-type', pieceType: 'sapphire' },
      });
    }
  });

  it('accepts wildcard plus wildcard and records both direct triggers', () => {
    const board = Board.fromGrid([
      [wildcardPiece('ruby'), wildcardPiece('emerald')],
      [standardPiece('emerald'), standardPiece('topaz')],
    ]);

    const result = validatePlayableSwap(board, { row: 0, column: 0 }, { row: 0, column: 1 });
    expect(result.isValid).toBe(true);
    if (!result.isValid) {
      return;
    }

    expect(result.kind).toBe('wildcard-swap');
    expect(result.directActivationTriggers).toEqual([
      {
        coordinate: { row: 0, column: 1 },
        reason: 'direct-swap',
        wildcardTarget: { mode: 'entire-board' },
      },
      {
        coordinate: { row: 0, column: 0 },
        reason: 'direct-swap',
        wildcardTarget: { mode: 'entire-board' },
      },
    ]);
  });

  it('accepts special combinations and rejects non-wildcard special plus standard without match', () => {
    const specialCombo = Board.fromGrid([
      [lineClearPiece('ruby', 'horizontal'), areaClearPiece('topaz')],
      [standardPiece('emerald'), standardPiece('amethyst')],
    ]);

    const combo = validatePlayableSwap(specialCombo, { row: 0, column: 0 }, { row: 0, column: 1 });
    expect(combo.isValid).toBe(true);
    if (combo.isValid) {
      expect(combo.kind).toBe('special-combination');
      expect(combo.directActivationTriggers).toHaveLength(2);
    }

    const rejected = Board.fromGrid([
      [lineClearPiece('ruby', 'horizontal'), standardPiece('topaz')],
      [standardPiece('emerald'), standardPiece('amethyst')],
    ]);

    expect(
      validatePlayableSwap(rejected, { row: 0, column: 0 }, { row: 0, column: 1 }),
    ).toMatchObject({
      isValid: false,
      reason: 'no-match-created',
    });
  });
});
