import { describe, expect, it } from 'vitest';
import { findPlayableSwaps } from '../../../src/game/board';
import { selectHint } from '../../../src/game/presentation/hints/selectHint';
import { createPuzzlePresentationState } from '../../../src/game/presentation/state/presentationPermissions';
import { standardBoard } from '../board/boardTestHelpers';

describe('selectHint', () => {
  const board = standardBoard([
    ['ruby', 'sapphire', 'ruby'],
    ['topaz', 'ruby', 'emerald'],
    ['amethyst', 'pearl', 'topaz'],
  ]);

  it('selects the first playable domain move without mutating the board', () => {
    const snapshot = board.toGridSnapshot();
    const expected = findPlayableSwaps(board)[0];
    const result = selectHint({
      board,
      levelIsActive: true,
      hintsEnabled: true,
      presentationState: createPuzzlePresentationState(),
    });

    expect(result).toEqual({ kind: 'hint', move: expected });
    expect(board.toGridSnapshot()).toEqual(snapshot);
  });

  it('rejects disabled, inactive, playback, and no-move requests defensively', () => {
    expect(
      selectHint({
        board,
        levelIsActive: true,
        hintsEnabled: false,
        presentationState: createPuzzlePresentationState(),
      }),
    ).toEqual({ kind: 'unavailable', reason: 'disabled' });
    expect(
      selectHint({
        board,
        levelIsActive: false,
        hintsEnabled: true,
        presentationState: createPuzzlePresentationState(),
      }),
    ).toEqual({ kind: 'unavailable', reason: 'inactive' });
    expect(
      selectHint({
        board,
        levelIsActive: true,
        hintsEnabled: true,
        presentationState: { ...createPuzzlePresentationState(), playbackActive: true },
      }),
    ).toEqual({ kind: 'unavailable', reason: 'inactive' });

    const noMoveBoard = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);
    expect(
      selectHint({
        board: noMoveBoard,
        levelIsActive: true,
        hintsEnabled: true,
        presentationState: createPuzzlePresentationState(),
      }),
    ).toEqual({ kind: 'unavailable', reason: 'no-playable-move' });
  });
});
