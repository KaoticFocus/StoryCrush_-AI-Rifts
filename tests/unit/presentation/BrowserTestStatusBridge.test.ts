import { describe, expect, it } from 'vitest';
import { Board, createLineClearPiece } from '../../../src/game/board';
import { getBoardHash } from '../../../src/game/presentation/testing/BrowserTestStatusBridge';

describe('getBoardHash', () => {
  it('is deterministic and includes line-clear orientation', () => {
    const horizontal = Board.fromGrid([
      [createLineClearPiece('ruby', 'horizontal'), { kind: 'standard', pieceType: 'sapphire' }],
    ]);
    const vertical = Board.fromGrid([
      [createLineClearPiece('ruby', 'vertical'), { kind: 'standard', pieceType: 'sapphire' }],
    ]);

    expect(getBoardHash(horizontal)).toBe(getBoardHash(horizontal));
    expect(getBoardHash(horizontal)).not.toBe(getBoardHash(vertical));
    expect(getBoardHash(horizontal)).toContain('1x2|line-clear:ruby:horizontal');
  });
});
