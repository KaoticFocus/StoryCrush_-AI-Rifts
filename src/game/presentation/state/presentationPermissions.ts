export interface PuzzlePresentationState {
  paused: boolean;
  playbackActive: boolean;
  inputLocked: boolean;
  shuttingDown: boolean;
  hasActiveHint: boolean;
}

export function createPuzzlePresentationState(): PuzzlePresentationState {
  return {
    paused: false,
    playbackActive: false,
    inputLocked: false,
    shuttingDown: false,
    hasActiveHint: false,
  };
}

export function canAcceptBoardInput(input: {
  state: PuzzlePresentationState;
  levelIsActive: boolean;
}): boolean {
  const { state, levelIsActive } = input;
  return (
    levelIsActive &&
    !state.paused &&
    !state.playbackActive &&
    !state.inputLocked &&
    !state.shuttingDown
  );
}

export function canRequestHint(input: {
  state: PuzzlePresentationState;
  levelIsActive: boolean;
  hintsEnabled: boolean;
}): boolean {
  return input.hintsEnabled && canAcceptBoardInput(input);
}

export function canPause(state: PuzzlePresentationState): boolean {
  return !state.shuttingDown && !state.paused;
}
