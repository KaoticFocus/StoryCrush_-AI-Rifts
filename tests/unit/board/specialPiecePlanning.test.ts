import { describe, expect, it } from 'vitest';
import { Board } from '../../../src/game/board/Board';
import { findMatchRuns } from '../../../src/game/board/matchDetection';
import { planSpecialPieceCreations } from '../../../src/game/board/specialPiecePlanning';
import { standardBoard } from './boardTestHelpers';

function gridToKey(board: Board): string {
  return JSON.stringify(board.toGridSnapshot());
}

describe('special piece planning', () => {
  it('chooses the swap coordinate when it belongs to the match group', () => {
    const board = standardBoard([['ruby', 'ruby', 'ruby', 'ruby']]);
    const before = gridToKey(board);
    const matches = findMatchRuns(board);

    const result = planSpecialPieceCreations({
      matches,
      swap: {
        from: { row: 0, column: 0 },
        to: { row: 0, column: 2 },
      },
    });

    expect(gridToKey(board)).toBe(before);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].shape).toBe('straight-4');
    expect(result.specialCreations).toHaveLength(1);
    expect(result.specialCreations[0].creationCoordinate).toEqual({ row: 0, column: 2 });
    expect(result.specialCreations[0].specialPiece).toEqual({
      kind: 'line-clear',
      pieceType: 'ruby',
      // Horizontal four creates a vertical-clearing special.
      orientation: 'vertical',
    });
  });

  it('falls back to the pivot coordinate for turned match shapes and round-trips through json', () => {
    const board = standardBoard([
      ['emerald', 'topaz', 'amethyst', 'pearl'],
      ['topaz', 'ruby', 'ruby', 'ruby'],
      ['emerald', 'sapphire', 'ruby', 'amethyst'],
      ['pearl', 'topaz', 'ruby', 'sapphire'],
    ]);
    const before = gridToKey(board);
    const matches = findMatchRuns(board);

    const result = planSpecialPieceCreations({ matches });
    const roundTrip = JSON.parse(JSON.stringify(result));

    expect(gridToKey(board)).toBe(before);
    expect(result.groups[0].shape).toBe('t-shape');
    expect(result.specialCreations[0].creationCoordinate).toEqual({ row: 1, column: 2 });
    expect(result.specialCreations[0].specialPiece.kind).toBe('cross-clear');
    expect(roundTrip).toEqual(result);
  });
});
