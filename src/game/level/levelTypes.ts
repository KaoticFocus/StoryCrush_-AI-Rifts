import { Board } from '../board/Board';
import {
  BoardCoordinate,
  BoardPiece,
  CascadeResolutionResult,
  PieceType,
  PlayableSwapFailureReason,
  PlayableSwapKind,
  ReshuffleResult,
  SpecialActivationReason,
} from '../board/boardTypes';
import type {
  RiftHungerDefinition,
  RiftHungerState,
  RiftHungerTransition,
} from './riftHungerTypes';

export type {
  RiftHungerCleanseCause,
  RiftHungerCleanseEvent,
  RiftHungerDefinition,
  RiftHungerProtectedCell,
  RiftHungerSpreadEvent,
  RiftHungerSpreadPriority,
  RiftHungerState,
  RiftHungerStatus,
  RiftHungerTransition,
} from './riftHungerTypes';

export type LevelStatus = 'active' | 'won' | 'failed';

export interface ScoreObjectiveDefinition {
  id: string;
  kind: 'score';
  targetScore: number;
}

export interface CollectPieceObjectiveDefinition {
  id: string;
  kind: 'collect-piece';
  pieceType: PieceType;
  targetCount: number;
}

export type LevelObjectiveDefinition = ScoreObjectiveDefinition | CollectPieceObjectiveDefinition;

export interface ScoringRules {
  pointsPerRemovedPiece: number;
  lineClearActivationBonus: number;
  /** Activation bonus for T/L/cross shaped specials (canonical cross-clear). */
  crossClearActivationBonus: number;
  wildcardActivationBonus: number;
  cascadeMultiplierIncrement: number;
  /**
   * @deprecated Alias for crossClearActivationBonus. Accepted on input for compatibility;
   * validateScoringRules normalizes to crossClearActivationBonus.
   * Rejected when present alongside a different crossClearActivationBonus.
   */
  areaClearActivationBonus?: number;
}

/** Compatibility input for validateScoringRules (canonical and/or legacy cross bonus). */
export type ScoringRulesValidationInput = Omit<ScoringRules, 'crossClearActivationBonus'> & {
  crossClearActivationBonus?: number;
  areaClearActivationBonus?: number;
};

export interface LevelReshuffleRules {
  maxRandomAttempts?: number;
  maxSearchNodes?: number;
}

export interface LevelDefinition {
  id: string;
  moveLimit: number;
  allowedRefillPieceTypes: readonly PieceType[];
  objectives: readonly LevelObjectiveDefinition[];
  scoring: ScoringRules;
  seed: number;
  maxCascadeSteps?: number;
  maxSpecialActivations?: number;
  reshuffle?: LevelReshuffleRules;
  /** Optional deterministic board threat. Absent on existing Fantasy levels. */
  threat?: RiftHungerDefinition;
}

export interface ObjectiveProgress {
  objectiveId: string;
  kind: LevelObjectiveDefinition['kind'];
  current: number;
  target: number;
  complete: boolean;
}

export interface ObjectiveProgressUpdate {
  objectiveId: string;
  previous: ObjectiveProgress;
  next: ObjectiveProgress;
  delta: number;
  completedThisMove: boolean;
}

export interface PieceClearScoreEvent {
  kind: 'piece-clear';
  stepIndex: number;
  removedCount: number;
  pointsPerPiece: number;
  multiplier: number;
  awardedPoints: number;
}

export interface SpecialActivationScoreEvent {
  kind: 'special-activation';
  stepIndex: number;
  activationIndex: number;
  specialKind: 'line-clear' | 'cross-clear' | 'wildcard';
  activationReason: SpecialActivationReason;
  baseBonus: number;
  multiplier: number;
  awardedPoints: number;
}

export type ScoreEvent = PieceClearScoreEvent | SpecialActivationScoreEvent;

export interface ScoreCalculationResult {
  events: ScoreEvent[];
  stepTotals: Array<{
    stepIndex: number;
    awardedPoints: number;
  }>;
  pieceClearSubtotal: number;
  specialActivationSubtotal: number;
  totalAwardedPoints: number;
}

export interface PieceCollectionEvent {
  stepIndex: number;
  coordinate: BoardCoordinate;
  piece: BoardPiece;
  pieceType: PieceType;
}

export interface LevelSessionState {
  levelId: string;
  baseSeed: number;
  board: Board;
  score: number;
  movesRemaining: number;
  acceptedMoveCount: number;
  status: LevelStatus;
  objectiveProgress: ObjectiveProgress[];
  /** Present only when the level definition declares a threat. */
  threatState?: RiftHungerState;
}

export type LevelSeedPurpose = 'move-resolution' | 'post-move-reshuffle' | 'initial-reshuffle';

export interface AcceptedLevelMoveResult {
  accepted: true;
  requestedSwap: {
    from: BoardCoordinate;
    to: BoardCoordinate;
  };
  moveKind: PlayableSwapKind;
  previousState: LevelSessionState;
  nextState: LevelSessionState;
  previousStatus: LevelStatus;
  nextStatus: LevelStatus;
  scoreBefore: number;
  scoreAfter: number;
  movesBefore: number;
  movesAfter: number;
  movesConsumed: 1;
  resolutionSeed: number;
  resolution: Extract<CascadeResolutionResult, { isValid: true }>;
  scoreCalculation: ScoreCalculationResult;
  collectionEvents: PieceCollectionEvent[];
  objectiveUpdates: ObjectiveProgressUpdate[];
  reshuffle?: ReshuffleResult;
  /**
   * Present for threat-enabled levels on every accepted move.
   * Omitted for levels without a threat definition.
   */
  threatTransition?: RiftHungerTransition;
}

export interface RejectedLevelMoveResult {
  accepted: false;
  kind: 'rejected';
  reason: PlayableSwapFailureReason;
  structuralReason?: string;
  requestedSwap: {
    from: BoardCoordinate;
    to: BoardCoordinate;
  };
  state: LevelSessionState;
  movesConsumed: 0;
  scoreCalculation?: undefined;
  collectionEvents?: undefined;
  objectiveUpdates?: undefined;
  resolution?: undefined;
}

export interface TerminalLevelMoveResult {
  accepted: false;
  kind: 'terminal';
  terminalStatus: Exclude<LevelStatus, 'active'>;
  requestedSwap: {
    from: BoardCoordinate;
    to: BoardCoordinate;
  };
  state: LevelSessionState;
  movesConsumed: 0;
  scoreCalculation?: undefined;
  collectionEvents?: undefined;
  objectiveUpdates?: undefined;
  resolution?: undefined;
}

export type LevelMoveResult =
  AcceptedLevelMoveResult | RejectedLevelMoveResult | TerminalLevelMoveResult;

export interface CreateLevelSessionResult {
  state: LevelSessionState;
  initialReshuffle?: ReshuffleResult;
}
