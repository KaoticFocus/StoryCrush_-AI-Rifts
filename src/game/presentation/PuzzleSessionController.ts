import { type BoardCoordinate } from '../board';
import {
  applyLevelMove,
  type LevelDefinition,
  type LevelMoveResult,
  type LevelSessionState,
} from '../level';

function cloneDefinition(definition: LevelDefinition): LevelDefinition {
  return {
    ...definition,
    allowedRefillPieceTypes: [...definition.allowedRefillPieceTypes],
    objectives: definition.objectives.map((objective) => ({ ...objective })),
    scoring: { ...definition.scoring },
    reshuffle: definition.reshuffle ? { ...definition.reshuffle } : undefined,
  };
}

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
  };
}

export class PuzzleSessionController {
  private state: LevelSessionState;
  private lastMoveResult: LevelMoveResult | null = null;
  private readonly createInitialState: () => LevelSessionState;

  public constructor(definition: LevelDefinition, createInitialState: () => LevelSessionState) {
    this.definition = cloneDefinition(definition);
    this.createInitialState = createInitialState;
    this.state = cloneState(createInitialState());
  }

  private readonly definition: LevelDefinition;

  public getDefinition(): LevelDefinition {
    return cloneDefinition(this.definition);
  }

  public getState(): LevelSessionState {
    return cloneState(this.state);
  }

  public getLastMoveResult(): LevelMoveResult | null {
    return this.lastMoveResult;
  }

  public requestSwap(from: BoardCoordinate, to: BoardCoordinate): LevelMoveResult {
    const moveResult = applyLevelMove({
      definition: this.definition,
      state: this.state,
      from,
      to,
    });

    if (moveResult.accepted) {
      this.state = cloneState(moveResult.nextState);
    }

    this.lastMoveResult = moveResult;
    return moveResult;
  }

  public restart(): LevelSessionState {
    this.state = cloneState(this.createInitialState());
    this.lastMoveResult = null;
    return this.getState();
  }
}
