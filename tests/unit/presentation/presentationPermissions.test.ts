import { describe, expect, it } from 'vitest';
import {
  canAcceptBoardInput,
  canPause,
  canRequestHint,
  createPuzzlePresentationState,
} from '../../../src/game/presentation/state/presentationPermissions';

describe('presentation permissions', () => {
  it('allows active idle input and rejects paused, playing, terminal, and shutdown states', () => {
    const state = createPuzzlePresentationState();
    expect(canAcceptBoardInput({ state, levelIsActive: true })).toBe(true);
    expect(canRequestHint({ state, levelIsActive: true, hintsEnabled: true })).toBe(true);
    expect(canPause(state)).toBe(true);

    expect(canAcceptBoardInput({ state: { ...state, paused: true }, levelIsActive: true })).toBe(
      false,
    );
    expect(
      canAcceptBoardInput({ state: { ...state, playbackActive: true }, levelIsActive: true }),
    ).toBe(false);
    expect(canAcceptBoardInput({ state, levelIsActive: false })).toBe(false);
    expect(canRequestHint({ state, levelIsActive: true, hintsEnabled: false })).toBe(false);
    expect(canPause({ ...state, paused: true })).toBe(false);
  });
});
