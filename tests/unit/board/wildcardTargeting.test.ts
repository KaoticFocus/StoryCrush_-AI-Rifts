import { describe, expect, it } from 'vitest';
import { determineWildcardTarget } from '../../../src/game/board/wildcardTargeting';
import { standardPiece, wildcardPiece, lineClearPiece, crossClearPiece } from './boardTestHelpers';

describe('determineWildcardTarget', () => {
  it('uses wildcard stored type for matched activation', () => {
    expect(
      determineWildcardTarget({ wildcardPiece: wildcardPiece('emerald'), reason: 'matched' }),
    ).toEqual({ mode: 'piece-type', pieceType: 'emerald' });
  });

  it('uses wildcard stored type for chain-reaction activation', () => {
    expect(
      determineWildcardTarget({ wildcardPiece: wildcardPiece('topaz'), reason: 'chain-reaction' }),
    ).toEqual({ mode: 'piece-type', pieceType: 'topaz' });
  });

  it('targets swapped standard type on direct swap', () => {
    expect(
      determineWildcardTarget({
        wildcardPiece: wildcardPiece('ruby'),
        reason: 'direct-swap',
        swapCounterpartPiece: standardPiece('pearl'),
      }),
    ).toEqual({ mode: 'piece-type', pieceType: 'pearl' });
  });

  it('targets swapped non-wildcard special underlying type on direct swap', () => {
    expect(
      determineWildcardTarget({
        wildcardPiece: wildcardPiece('ruby'),
        reason: 'direct-swap',
        swapCounterpartPiece: lineClearPiece('sapphire', 'vertical'),
      }),
    ).toEqual({ mode: 'piece-type', pieceType: 'sapphire' });

    expect(
      determineWildcardTarget({
        wildcardPiece: wildcardPiece('ruby'),
        reason: 'direct-swap',
        swapCounterpartPiece: crossClearPiece('amethyst'),
      }),
    ).toEqual({ mode: 'piece-type', pieceType: 'amethyst' });
  });

  it('targets the entire board on wildcard plus wildcard direct swap', () => {
    expect(
      determineWildcardTarget({
        wildcardPiece: wildcardPiece('ruby'),
        reason: 'direct-swap',
        swapCounterpartPiece: wildcardPiece('emerald'),
      }),
    ).toEqual({ mode: 'entire-board' });
  });
});
