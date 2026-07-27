import { describe, expect, it } from 'vitest';
import { BoardDomainError } from '../../../src/game/board';
import { planReshuffleMovements } from '../../../src/game/presentation/playback/reshuffleMovementPlanning';
import {
  areaClearPiece,
  boardFromPieces,
  lineClearPiece,
  standardPiece,
  wildcardPiece,
} from '../board/boardTestHelpers';

describe('planReshuffleMovements', () => {
  it('maps duplicate exact piece identities deterministically in row-major order', () => {
    const originalBoard = boardFromPieces([
      [standardPiece('ruby'), standardPiece('ruby')],
      [lineClearPiece('topaz', 'horizontal'), wildcardPiece('emerald')],
    ]);
    const reshuffledBoard = boardFromPieces([
      [wildcardPiece('emerald'), standardPiece('ruby')],
      [standardPiece('ruby'), lineClearPiece('topaz', 'horizontal')],
    ]);

    const plan = planReshuffleMovements({ originalBoard, reshuffledBoard });

    expect(plan.movements).toEqual([
      {
        index: 0,
        from: { row: 1, column: 0 },
        to: { row: 1, column: 1 },
        piece: lineClearPiece('topaz', 'horizontal'),
      },
      {
        index: 1,
        from: { row: 0, column: 0 },
        to: { row: 0, column: 1 },
        piece: standardPiece('ruby'),
      },
      {
        index: 2,
        from: { row: 0, column: 1 },
        to: { row: 1, column: 0 },
        piece: standardPiece('ruby'),
      },
      {
        index: 3,
        from: { row: 1, column: 1 },
        to: { row: 0, column: 0 },
        piece: wildcardPiece('emerald'),
      },
    ]);
    expect(plan.stationary).toEqual([]);
  });

  it('supports mixed exact piece identities including area-clear and orientation-sensitive specials', () => {
    const originalBoard = boardFromPieces([
      [areaClearPiece('amethyst'), lineClearPiece('ruby', 'vertical')],
      [wildcardPiece('ruby'), standardPiece('pearl')],
    ]);
    const reshuffledBoard = boardFromPieces([
      [standardPiece('pearl'), wildcardPiece('ruby')],
      [lineClearPiece('ruby', 'vertical'), areaClearPiece('amethyst')],
    ]);

    const plan = planReshuffleMovements({ originalBoard, reshuffledBoard });

    expect(plan.movements).toHaveLength(4);
    expect(plan.movements.every((movement, index) => movement.index === index)).toBe(true);
  });

  it('rejects inventory and dimension mismatches', () => {
    expect(() =>
      planReshuffleMovements({
        originalBoard: boardFromPieces([[standardPiece('ruby')]]),
        reshuffledBoard: boardFromPieces([[standardPiece('sapphire')]]),
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      planReshuffleMovements({
        originalBoard: boardFromPieces([[standardPiece('ruby')]]),
        reshuffledBoard: boardFromPieces([[standardPiece('ruby'), standardPiece('ruby')]]),
      }),
    ).toThrowError(BoardDomainError);
  });
});
