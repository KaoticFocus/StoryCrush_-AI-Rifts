import { BoardCoordinate } from '../board/boardTypes';
import { BoardDomainError } from '../board/errors';
import { isDeadBoard } from '../board/deadBoard';
import { reshuffleDeadBoard } from '../board/reshuffleBoard';
import { resolveCascade } from '../board/resolveCascade';
import { validatePlayableSwap } from '../board/playableSwapValidation';
import {
  AcceptedLevelMoveResult,
  LevelDefinition,
  LevelMoveResult,
  LevelSessionState,
  LevelStatus,
  ObjectiveProgress,
  RejectedLevelMoveResult,
  TerminalLevelMoveResult,
} from './levelTypes';
import { calculateResolutionScore } from './scoring';
import { createPieceCollectionEvents } from './collectionEvents';
import { areAllObjectivesComplete, updateObjectiveProgress } from './objectives';
import { advanceRiftHungerForAcceptedMove } from './riftHungerResolution';
import { cloneRiftHungerState } from './riftHungerValidation';
import { deriveLevelSeed } from './seedDerivation';
import { validateLevelDefinition, validateLevelStateRelationship } from './levelValidation';

function cloneCoordinate(coordinate: BoardCoordinate): BoardCoordinate {
  return { row: coordinate.row, column: coordinate.column };
}

function cloneObjectiveProgress(progress: readonly ObjectiveProgress[]): ObjectiveProgress[] {
  return progress.map((entry) => ({ ...entry }));
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
    objectiveProgress: cloneObjectiveProgress(state.objectiveProgress),
    threatState: state.threatState ? cloneRiftHungerState(state.threatState) : undefined,
  };
}

function safeAdd(a: number, b: number, label: string): number {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) {
    throw new BoardDomainError('score-overflow', `${label} overflowed safe integer range`);
  }

  return sum;
}

function terminalResult(
  state: LevelSessionState,
  from: BoardCoordinate,
  to: BoardCoordinate,
): TerminalLevelMoveResult {
  if (state.status === 'active') {
    throw new BoardDomainError('invalid-level-state', 'terminal result requires non-active state');
  }

  return {
    accepted: false,
    kind: 'terminal',
    terminalStatus: state.status,
    requestedSwap: {
      from: cloneCoordinate(from),
      to: cloneCoordinate(to),
    },
    state: cloneState(state),
    movesConsumed: 0,
  };
}

function rejectedResult(input: {
  state: LevelSessionState;
  from: BoardCoordinate;
  to: BoardCoordinate;
  reason: 'no-match-created' | 'structurally-invalid';
  structuralReason?: string;
}): RejectedLevelMoveResult {
  return {
    accepted: false,
    kind: 'rejected',
    reason: input.reason,
    structuralReason: input.structuralReason,
    requestedSwap: {
      from: cloneCoordinate(input.from),
      to: cloneCoordinate(input.to),
    },
    state: cloneState(input.state),
    movesConsumed: 0,
  };
}

function resolveStatusWithoutThreat(
  nextProgress: readonly ObjectiveProgress[],
  movesRemaining: number,
): LevelStatus {
  if (areAllObjectivesComplete(nextProgress)) {
    return 'won';
  }

  if (movesRemaining === 0) {
    return 'failed';
  }

  return 'active';
}

export function applyLevelMove(input: {
  definition: LevelDefinition;
  state: LevelSessionState;
  from: BoardCoordinate;
  to: BoardCoordinate;
}): LevelMoveResult {
  const definition = validateLevelDefinition(input.definition);
  validateLevelStateRelationship(definition, input.state);

  const previousState = cloneState(input.state);

  if (previousState.status !== 'active') {
    return terminalResult(previousState, input.from, input.to);
  }

  const playableSwap = validatePlayableSwap(previousState.board, input.from, input.to);
  if (!playableSwap.isValid) {
    return rejectedResult({
      state: previousState,
      from: input.from,
      to: input.to,
      reason: playableSwap.reason ?? 'structurally-invalid',
      structuralReason: playableSwap.structuralReason,
    });
  }

  const acceptedMoveIndex = previousState.acceptedMoveCount;
  const resolutionSeed = deriveLevelSeed({
    baseSeed: previousState.baseSeed,
    acceptedMoveIndex,
    purpose: 'move-resolution',
  });

  const resolution = resolveCascade({
    board: previousState.board,
    first: input.from,
    second: input.to,
    pieceTypes: definition.allowedRefillPieceTypes,
    seed: resolutionSeed,
    maxCascadeSteps: definition.maxCascadeSteps,
    maxSpecialActivations: definition.maxSpecialActivations,
  });

  if (!resolution.isValid) {
    return rejectedResult({
      state: previousState,
      from: input.from,
      to: input.to,
      reason: resolution.reason,
      structuralReason: resolution.structuralReason,
    });
  }

  if (!playableSwap.kind) {
    return rejectedResult({
      state: previousState,
      from: input.from,
      to: input.to,
      reason: 'structurally-invalid',
      structuralReason: 'playable swap did not include a swap kind',
    });
  }

  const scoreCalculation = calculateResolutionScore({
    resolution,
    rules: definition.scoring,
  });

  const scoreAfter = safeAdd(
    previousState.score,
    scoreCalculation.totalAwardedPoints,
    'level cumulative score',
  );

  const collectionEvents = createPieceCollectionEvents({ resolution });

  const objectiveProgressResult = updateObjectiveProgress({
    definition,
    previousProgress: previousState.objectiveProgress,
    nextScore: scoreAfter,
    scoreDelta: scoreCalculation.totalAwardedPoints,
    collectionEvents,
  });

  const movesAfter = previousState.movesRemaining - 1;
  if (!Number.isSafeInteger(movesAfter) || movesAfter < 0) {
    throw new BoardDomainError('invalid-level-state', 'movesRemaining cannot become negative');
  }

  const acceptedMoveCountAfter = previousState.acceptedMoveCount + 1;
  if (!Number.isSafeInteger(acceptedMoveCountAfter)) {
    throw new BoardDomainError(
      'invalid-level-state',
      'acceptedMoveCount overflowed safe integer range',
    );
  }

  /**
   * RH-0 fairness order:
   * 1) Objective completion wins before pending threat spread.
   * 2) Otherwise advance Rift Hunger once for this accepted move.
   * 3) Overwhelm fails before move-exhaustion failure.
   * 4) Reshuffle only while the level remains active.
   */
  let resolvedStatus: LevelStatus;
  let nextThreatState = previousState.threatState
    ? cloneRiftHungerState(previousState.threatState)
    : undefined;
  let threatTransition: AcceptedLevelMoveResult['threatTransition'];

  if (areAllObjectivesComplete(objectiveProgressResult.nextProgress)) {
    resolvedStatus = 'won';
  } else if (definition.threat && previousState.threatState) {
    threatTransition = advanceRiftHungerForAcceptedMove({
      definition: definition.threat,
      state: previousState.threatState,
      boardDimensions: resolution.finalBoard.getDimensions(),
    });
    nextThreatState = cloneRiftHungerState(threatTransition.nextState);

    if (nextThreatState.status === 'overwhelmed') {
      resolvedStatus = 'failed';
    } else if (movesAfter === 0) {
      resolvedStatus = 'failed';
    } else {
      resolvedStatus = 'active';
    }
  } else {
    resolvedStatus = resolveStatusWithoutThreat(objectiveProgressResult.nextProgress, movesAfter);
  }

  let finalBoard = resolution.finalBoard;
  let reshuffle;

  if (resolvedStatus === 'active' && isDeadBoard(finalBoard)) {
    const reshuffleSeed = deriveLevelSeed({
      baseSeed: previousState.baseSeed,
      acceptedMoveIndex,
      purpose: 'post-move-reshuffle',
    });

    reshuffle = reshuffleDeadBoard({
      board: finalBoard,
      seed: reshuffleSeed,
      maxRandomAttempts: definition.reshuffle?.maxRandomAttempts,
      maxSearchNodes: definition.reshuffle?.maxSearchNodes,
    });

    finalBoard = reshuffle.reshuffledBoard;
  }

  const nextState: LevelSessionState = {
    levelId: previousState.levelId,
    baseSeed: previousState.baseSeed,
    board: finalBoard,
    score: scoreAfter,
    movesRemaining: movesAfter,
    acceptedMoveCount: acceptedMoveCountAfter,
    status: resolvedStatus,
    objectiveProgress: cloneObjectiveProgress(objectiveProgressResult.nextProgress),
    threatState: nextThreatState,
  };

  const result: AcceptedLevelMoveResult = {
    accepted: true,
    requestedSwap: {
      from: cloneCoordinate(input.from),
      to: cloneCoordinate(input.to),
    },
    moveKind: playableSwap.kind,
    previousState,
    nextState: cloneState(nextState),
    previousStatus: previousState.status,
    nextStatus: nextState.status,
    scoreBefore: previousState.score,
    scoreAfter: nextState.score,
    movesBefore: previousState.movesRemaining,
    movesAfter: nextState.movesRemaining,
    movesConsumed: 1,
    resolutionSeed,
    resolution,
    scoreCalculation,
    collectionEvents,
    objectiveUpdates: objectiveProgressResult.updates,
    reshuffle,
    threatTransition,
  };

  return result;
}
