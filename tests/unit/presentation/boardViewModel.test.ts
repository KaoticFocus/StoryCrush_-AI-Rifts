import { describe, expect, it } from 'vitest';
import { boardFromPieces, lineClearPiece, wildcardPiece } from '../board/boardTestHelpers';
import { createBoardViewModel } from '../../../src/game/presentation/boardViewModel';

describe('boardViewModel', () => {
  it('maps standard and special pieces into distinct appearances', () => {
    const board = boardFromPieces([
      [wildcardPiece('ruby'), lineClearPiece('sapphire', 'horizontal')],
      [lineClearPiece('emerald', 'vertical'), wildcardPiece('topaz')],
    ]);

    const viewModel = createBoardViewModel(board);

    expect(viewModel.cells[0].appearance.overlay.kind).toBe('wildcard');
    expect(viewModel.cells[1].appearance.overlay).toEqual({
      kind: 'line-clear',
      orientation: 'horizontal',
    });
    expect(viewModel.cells[2].appearance.overlay).toEqual({
      kind: 'line-clear',
      orientation: 'vertical',
    });
    expect(viewModel.cells[0].appearance.shape).not.toBe(viewModel.cells[1].appearance.shape);
  });

  it('returns defensively isolated board cell data', () => {
    const board = boardFromPieces([[wildcardPiece('ruby')]]);

    const first = createBoardViewModel(board);
    first.cells[0].coordinate.row = 99;
    first.cells[0].piece.pieceType = 'sapphire';

    const second = createBoardViewModel(board);
    expect(second.cells[0].coordinate).toEqual({ row: 0, column: 0 });
    expect(second.cells[0].piece.pieceType).toBe('ruby');
  });
});
