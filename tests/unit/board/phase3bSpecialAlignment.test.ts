import { describe, expect, it } from 'vitest';
import { Board } from '../../../src/game/board/Board';
import { findMatchRuns } from '../../../src/game/board/matchDetection';
import { normalizeBoardPiece } from '../../../src/game/board/boardPieces';
import { getSpecialActivationEffect } from '../../../src/game/board/specialActivation';
import { planSpecialPieceCreations } from '../../../src/game/board/specialPiecePlanning';
import {
  boardFromPieces,
  crossClearPiece,
  lineClearPiece,
  standardBoard,
  standardPiece,
} from './boardTestHelpers';

describe('Phase 3B special-rule alignment', () => {
  it('maps horizontal straight-four to a vertical-clearing line special', () => {
    const board = standardBoard([['ruby', 'ruby', 'ruby', 'ruby']]);
    const result = planSpecialPieceCreations({
      matches: findMatchRuns(board),
      swap: { from: { row: 0, column: 0 }, to: { row: 0, column: 3 } },
    });

    expect(result.specialCreations[0].specialPiece).toEqual({
      kind: 'line-clear',
      pieceType: 'ruby',
      orientation: 'vertical',
    });
    expect(result.specialCreations[0].creationCoordinate).toEqual({ row: 0, column: 3 });
  });

  it('maps vertical straight-four to a horizontal-clearing line special', () => {
    const board = standardBoard([['sapphire'], ['sapphire'], ['sapphire'], ['sapphire']]);
    const result = planSpecialPieceCreations({
      matches: findMatchRuns(board),
      swap: { from: { row: 0, column: 0 }, to: { row: 3, column: 0 } },
    });

    expect(result.groups[0].shape).toBe('straight-4');
    expect(result.specialCreations[0].specialPiece).toEqual({
      kind: 'line-clear',
      pieceType: 'sapphire',
      orientation: 'horizontal',
    });
  });

  it('creates cross-clear for T and L shapes at the pivot', () => {
    // Same T fixture as specialPiecePlanning: horizontal 3 + vertical stem.
    const board = standardBoard([
      ['emerald', 'topaz', 'amethyst', 'pearl'],
      ['topaz', 'ruby', 'ruby', 'ruby'],
      ['emerald', 'sapphire', 'ruby', 'amethyst'],
      ['pearl', 'topaz', 'ruby', 'sapphire'],
    ]);
    const tResult = planSpecialPieceCreations({ matches: findMatchRuns(board) });
    expect(tResult.groups[0].shape).toBe('t-shape');
    expect(tResult.specialCreations[0].specialPiece.kind).toBe('cross-clear');
    expect(tResult.specialCreations[0].creationCoordinate).toEqual({ row: 1, column: 2 });

    const lMatches = {
      runs: [
        {
          orientation: 'horizontal' as const,
          pieceType: 'emerald' as const,
          coordinates: [
            { row: 2, column: 1 },
            { row: 2, column: 2 },
            { row: 2, column: 3 },
          ],
        },
        {
          orientation: 'vertical' as const,
          pieceType: 'emerald' as const,
          coordinates: [
            { row: 2, column: 3 },
            { row: 3, column: 3 },
            { row: 4, column: 3 },
          ],
        },
      ],
      matchedCoordinates: [
        { row: 2, column: 1 },
        { row: 2, column: 2 },
        { row: 2, column: 3 },
        { row: 3, column: 3 },
        { row: 4, column: 3 },
      ],
    };
    const lResult = planSpecialPieceCreations({ matches: lMatches });
    expect(lResult.groups[0].shape).toBe('l-shape');
    expect(lResult.specialCreations[0].specialPiece.kind).toBe('cross-clear');
    expect(lResult.specialCreations[0].creationCoordinate).toEqual({ row: 2, column: 3 });
  });

  it('cross-clear activation includes center once at a board corner', () => {
    const board = boardFromPieces([
      [crossClearPiece('ruby'), standardPiece('sapphire'), standardPiece('emerald')],
      [standardPiece('topaz'), standardPiece('amethyst'), standardPiece('pearl')],
      [standardPiece('ruby'), standardPiece('sapphire'), standardPiece('emerald')],
    ]);
    const affected = getSpecialActivationEffect({
      board,
      coordinate: { row: 0, column: 0 },
    });
    const keys = affected.map((coordinate) => `${coordinate.row},${coordinate.column}`);
    expect(keys).toEqual(['0,0', '0,1', '0,2', '1,0', '2,0']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('line-clear never clears both directions', () => {
    const board = boardFromPieces([
      [standardPiece('ruby'), lineClearPiece('ruby', 'horizontal'), standardPiece('emerald')],
      [standardPiece('topaz'), standardPiece('amethyst'), standardPiece('pearl')],
      [standardPiece('ruby'), standardPiece('sapphire'), standardPiece('emerald')],
    ]);
    const affected = getSpecialActivationEffect({
      board,
      coordinate: { row: 0, column: 1 },
    });
    expect(affected.every((coordinate) => coordinate.row === 0)).toBe(true);
    expect(affected).toHaveLength(3);
  });

  it('normalizes legacy area-clear pieces to cross-clear', () => {
    const migrated = normalizeBoardPiece({ kind: 'area-clear', pieceType: 'sapphire' });
    expect(migrated).toEqual({ kind: 'cross-clear', pieceType: 'sapphire' });

    const board = Board.fromGrid([
      [{ kind: 'area-clear', pieceType: 'emerald' }, standardPiece('ruby')],
      [standardPiece('topaz'), standardPiece('pearl')],
    ]);
    expect(board.getPieceAt({ row: 0, column: 0 }).kind).toBe('cross-clear');
  });

  it('replays the same straight-four plan for identical seeds and swaps', () => {
    const board = standardBoard([['ruby', 'ruby', 'ruby', 'ruby']]);
    const matches = findMatchRuns(board);
    const swap = { from: { row: 0, column: 1 }, to: { row: 0, column: 2 } };
    const first = planSpecialPieceCreations({ matches, swap });
    const second = planSpecialPieceCreations({ matches, swap });
    expect(second).toEqual(first);
  });
});
