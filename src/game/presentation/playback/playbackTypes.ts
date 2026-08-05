import {
  type AcceptedLevelMoveResult,
  type LevelStatus,
  type PieceCollectionEvent,
  type ScoreCalculationResult,
  type RiftHungerCleanseEvent,
  type RiftHungerSpreadEvent,
  type RiftHungerState,
} from '../../level';
import {
  type AppliedSpecialCreation,
  type BoardCoordinate,
  type BoardPiece,
  type RefillPlacement,
  type ResolvableGrid,
  type SpecialActivationEvent,
} from '../../board';
import { type ObjectiveProgress } from '../../level';
import {
  type CollectionObjectiveFeedback,
  type ScoreObjectiveFeedback,
} from './objectivePresentationPlanning';
import { type ReshuffleMovementPlan } from './reshuffleMovementPlanning';
import { type ScorePresentationEntry } from './scorePresentationPlanning';
import { type SpecialEffectPresentationPlan } from './specialEffectPlanning';

export type PlaybackMode = 'normal' | 'fast' | 'instant';
export type EffectIntensity = 'standard' | 'reduced';

export type BoardSnapshot = BoardPiece[][];
export type ResolvableGridSnapshot = ResolvableGrid;

export interface GravityMovement {
  from: BoardCoordinate;
  to: BoardCoordinate;
  piece: BoardPiece;
  distance: number;
}

export interface RefillPresentationEntry {
  index: number;
  destination: BoardCoordinate;
  piece: RefillPlacement['piece'];
  startRow: number;
  stackIndex: number;
  stackSize: number;
}

interface PlaybackCommandBase {
  index: number;
  stepIndex: number | null;
}

export interface SwapPlaybackCommand extends PlaybackCommandBase {
  kind: 'swap';
  from: BoardCoordinate;
  to: BoardCoordinate;
  boardBefore: BoardSnapshot;
  boardAfter: BoardSnapshot;
}

export interface HighlightMatchesPlaybackCommand extends PlaybackCommandBase {
  kind: 'highlight-matches';
  matchedCoordinates: BoardCoordinate[];
  createdSpecialCoordinates: BoardCoordinate[];
}

export interface SpecialActivationPlaybackCommand extends PlaybackCommandBase {
  kind: 'special-activation';
  activation: SpecialActivationEvent;
  effectPlan: SpecialEffectPresentationPlan;
}

export interface RemovePiecesPlaybackCommand extends PlaybackCommandBase {
  kind: 'remove-pieces';
  removedCoordinates: BoardCoordinate[];
  boardBeforeRemoval: BoardSnapshot;
  gridAfterRemoval: ResolvableGridSnapshot;
}

export interface CreateSpecialsPlaybackCommand extends PlaybackCommandBase {
  kind: 'create-specials';
  createdSpecialPieces: AppliedSpecialCreation[];
  gridAfterCreation: ResolvableGridSnapshot;
}

export interface ApplyGravityPlaybackCommand extends PlaybackCommandBase {
  kind: 'apply-gravity';
  gridBefore: ResolvableGridSnapshot;
  gridAfter: ResolvableGridSnapshot;
  movements: GravityMovement[];
}

export interface RefillPiecesPlaybackCommand extends PlaybackCommandBase {
  kind: 'refill-pieces';
  gridBefore: ResolvableGridSnapshot;
  boardAfter: BoardSnapshot;
  placements: RefillPlacement[];
  entries: RefillPresentationEntry[];
}

export interface CascadePausePlaybackCommand extends PlaybackCommandBase {
  kind: 'cascade-pause';
  cascadeNumber: number;
}

export interface ScoreFeedbackPlaybackCommand extends PlaybackCommandBase {
  kind: 'score-feedback';
  scoreEntry: ScorePresentationEntry;
  linkedObjectiveFeedback: ScoreObjectiveFeedback[];
}

export interface ObjectiveFeedbackPlaybackCommand extends PlaybackCommandBase {
  kind: 'objective-feedback';
  collectionFeedback: CollectionObjectiveFeedback[];
  collectionEvents: PieceCollectionEvent[];
}

export interface ReshuffleMovementPlaybackCommand extends PlaybackCommandBase {
  kind: 'reshuffle-movement';
  fromBoard: BoardSnapshot;
  toBoard: BoardSnapshot;
  movementPlan: ReshuffleMovementPlan;
}

export interface RiftCleansePlaybackCommand extends PlaybackCommandBase {
  kind: 'rift-cleanse';
  events: RiftHungerCleanseEvent[];
}

export interface RiftSpreadPlaybackCommand extends PlaybackCommandBase {
  kind: 'rift-spread';
  event: RiftHungerSpreadEvent;
}

export interface RiftThreatSyncPlaybackCommand extends PlaybackCommandBase {
  kind: 'rift-threat-sync';
  state: RiftHungerState;
}

export interface SynchronizeBoardPlaybackCommand extends PlaybackCommandBase {
  kind: 'synchronize-board';
  board: BoardSnapshot;
  score: number;
  movesRemaining: number;
  status: LevelStatus;
  objectiveProgress: ObjectiveProgress[];
}

export type PlaybackCommand =
  | SwapPlaybackCommand
  | HighlightMatchesPlaybackCommand
  | SpecialActivationPlaybackCommand
  | ScoreFeedbackPlaybackCommand
  | ObjectiveFeedbackPlaybackCommand
  | RemovePiecesPlaybackCommand
  | CreateSpecialsPlaybackCommand
  | ApplyGravityPlaybackCommand
  | RefillPiecesPlaybackCommand
  | CascadePausePlaybackCommand
  | RiftCleansePlaybackCommand
  | RiftSpreadPlaybackCommand
  | RiftThreatSyncPlaybackCommand
  | ReshuffleMovementPlaybackCommand
  | SynchronizeBoardPlaybackCommand;

export interface PlaybackSummary {
  scoreCalculation: ScoreCalculationResult;
  cascadeCount: number;
  activationCount: number;
}

export interface MovePlaybackPlan {
  requestedSwap: AcceptedLevelMoveResult['requestedSwap'];
  previousBoard: BoardSnapshot;
  finalBoard: BoardSnapshot;
  commands: PlaybackCommand[];
  summary: PlaybackSummary;
}
