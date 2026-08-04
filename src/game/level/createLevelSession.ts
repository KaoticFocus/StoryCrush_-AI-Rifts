import { Board } from '../board/Board';
import { assertStableBoard, isDeadBoard } from '../board/deadBoard';
import { reshuffleDeadBoard } from '../board/reshuffleBoard';
import { CreateLevelSessionResult, LevelDefinition, LevelSessionState } from './levelTypes';
import { createInitialObjectiveProgress } from './objectives';
import { createInitialRiftHungerState } from './riftHungerState';
import { cloneRiftHungerState } from './riftHungerValidation';
import { deriveLevelSeed } from './seedDerivation';
import { validateLevelDefinition } from './levelValidation';

function cloneState(state: LevelSessionState): LevelSessionState {
  return {
    levelId: state.levelId,
    baseSeed: state.baseSeed,
    board: state.board,
    score: state.score,
    movesRemaining: state.movesRemaining,
    acceptedMoveCount: state.acceptedMoveCount,
    status: state.status,
    objectiveProgress: state.objectiveProgress.map((progress) => ({ ...progress })),
    threatState: state.threatState ? cloneRiftHungerState(state.threatState) : undefined,
  };
}

function createActiveState(
  definition: LevelDefinition,
  board: Board,
  threatState: LevelSessionState['threatState'],
): LevelSessionState {
  return {
    levelId: definition.id,
    baseSeed: definition.seed,
    board,
    score: 0,
    movesRemaining: definition.moveLimit,
    acceptedMoveCount: 0,
    status: 'active',
    objectiveProgress: createInitialObjectiveProgress({ definition }),
    threatState,
  };
}

export function createLevelSession(input: {
  definition: LevelDefinition;
  initialBoard: Board;
}): CreateLevelSessionResult {
  const definition = validateLevelDefinition(input.definition);

  // Threat overlay must exist before stability/playability checks so source cells
  // are treated as unavailable during initial dead-board evaluation.
  const threatState =
    definition.threat !== undefined
      ? createInitialRiftHungerState({
          definition: definition.threat,
          boardDimensions: input.initialBoard.getDimensions(),
        })
      : undefined;
  const unavailableCoordinates = threatState?.corruptedCells ?? [];

  assertStableBoard(input.initialBoard, unavailableCoordinates);

  if (!isDeadBoard(input.initialBoard, unavailableCoordinates)) {
    return {
      state: cloneState(createActiveState(definition, input.initialBoard, threatState)),
    };
  }

  const reshuffleSeed = deriveLevelSeed({
    baseSeed: definition.seed,
    acceptedMoveIndex: 0,
    purpose: 'initial-reshuffle',
  });

  const initialReshuffle = reshuffleDeadBoard({
    board: input.initialBoard,
    seed: reshuffleSeed,
    maxRandomAttempts: definition.reshuffle?.maxRandomAttempts,
    maxSearchNodes: definition.reshuffle?.maxSearchNodes,
    unavailableCoordinates,
  });

  const state = createActiveState(definition, initialReshuffle.reshuffledBoard, threatState);

  return {
    state: cloneState(state),
    initialReshuffle,
  };
}
