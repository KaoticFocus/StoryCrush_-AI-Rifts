import { findPlayableSwaps, type Board, type PlayableSwap } from '../../board';
import { type PuzzlePresentationState, canRequestHint } from '../state/presentationPermissions';

export type HintSelectionResult =
  | { kind: 'hint'; move: PlayableSwap }
  | { kind: 'unavailable'; reason: 'disabled' | 'inactive' | 'no-playable-move' };

export function selectHint(input: {
  board: Board;
  levelIsActive: boolean;
  hintsEnabled: boolean;
  presentationState: PuzzlePresentationState;
}): HintSelectionResult {
  if (
    !canRequestHint({
      state: input.presentationState,
      levelIsActive: input.levelIsActive,
      hintsEnabled: input.hintsEnabled,
    })
  ) {
    return {
      kind: 'unavailable',
      reason: input.hintsEnabled ? 'inactive' : 'disabled',
    };
  }

  const move = findPlayableSwaps(input.board)[0];
  if (!move) {
    return { kind: 'unavailable', reason: 'no-playable-move' };
  }

  return {
    kind: 'hint',
    move: {
      from: { ...move.from },
      to: { ...move.to },
      kind: move.kind,
    },
  };
}
