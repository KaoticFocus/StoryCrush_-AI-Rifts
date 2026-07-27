import { describe, expect, it } from 'vitest';
import { BoardDomainError, boardToResolvableGrid } from '../../../src/game/board';
import { applyGravity } from '../../../src/game/board/applyGravity';
import { planGravityMovements } from '../../../src/game/presentation/playback/gravityMovementPlanning';
import {
  boardFromPieces,
  lineClearPiece,
  standardGrid,
  standardPiece,
  wildcardPiece,
} from '../board/boardTestHelpers';

describe('planGravityMovements', () => {
  it('returns one-cell and multi-cell falls in deterministic order', () => {
    const before = standardGrid([
      ['ruby', null, 'emerald'],
      [null, 'sapphire', null],
      ['topaz', null, 'pearl'],
      [null, 'amethyst', null],
    ]);
    const after = applyGravity(before);

    const movements = planGravityMovements({
      gridBeforeGravity: before,
      gridAfterGravity: after,
    });

    expect(movements).toEqual([
      {
        from: { row: 2, column: 0 },
        to: { row: 3, column: 0 },
        piece: { kind: 'standard', pieceType: 'topaz' },
        distance: 1,
      },
      {
        from: { row: 0, column: 0 },
        to: { row: 2, column: 0 },
        piece: { kind: 'standard', pieceType: 'ruby' },
        distance: 2,
      },
      {
        from: { row: 1, column: 1 },
        to: { row: 2, column: 1 },
        piece: { kind: 'standard', pieceType: 'sapphire' },
        distance: 1,
      },
      {
        from: { row: 2, column: 2 },
        to: { row: 3, column: 2 },
        piece: { kind: 'standard', pieceType: 'pearl' },
        distance: 1,
      },
      {
        from: { row: 0, column: 2 },
        to: { row: 2, column: 2 },
        piece: { kind: 'standard', pieceType: 'emerald' },
        distance: 2,
      },
    ]);
  });

  it('preserves duplicate pieces and special-piece metadata', () => {
    const before = [
      [null, wildcardPiece('ruby')],
      [lineClearPiece('ruby', 'vertical'), null],
      [standardPiece('ruby'), standardPiece('ruby')],
    ];
    const after = applyGravity(before);

    const movements = planGravityMovements({
      gridBeforeGravity: before,
      gridAfterGravity: after,
    });

    expect(movements).toEqual([
      {
        from: { row: 0, column: 1 },
        to: { row: 1, column: 1 },
        piece: wildcardPiece('ruby'),
        distance: 1,
      },
    ]);
  });

  it('returns no movements when gravity does not change the grid', () => {
    const board = boardFromPieces([
      [
        { kind: 'standard', pieceType: 'ruby' },
        { kind: 'standard', pieceType: 'sapphire' },
      ],
      [
        { kind: 'standard', pieceType: 'emerald' },
        { kind: 'standard', pieceType: 'topaz' },
      ],
    ]);
    const grid = boardToResolvableGrid(board);

    const movements = planGravityMovements({
      gridBeforeGravity: grid,
      gridAfterGravity: grid,
    });

    expect(movements).toEqual([]);
  });

  it('rejects mismatched populated counts', () => {
    expect(() =>
      planGravityMovements({
        gridBeforeGravity: standardGrid([['ruby'], [null]]),
        gridAfterGravity: standardGrid([[null], [null]]),
      }),
    ).toThrowError(BoardDomainError);
  });
});
