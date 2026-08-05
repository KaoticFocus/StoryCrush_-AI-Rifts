export const DEFAULT_PIECE_TYPES = [
  'ruby',
  'sapphire',
  'emerald',
  'topaz',
  'amethyst',
  'pearl',
] as const;

export type PieceType = (typeof DEFAULT_PIECE_TYPES)[number];

export interface BoardCoordinate {
  row: number;
  column: number;
}

export interface BoardDimensions {
  rows: number;
  columns: number;
}

export type MatchOrientation = 'horizontal' | 'vertical';

export interface StandardBoardPiece {
  kind: 'standard';
  pieceType: PieceType;
}

export interface LineClearBoardPiece {
  kind: 'line-clear';
  pieceType: PieceType;
  orientation: MatchOrientation;
}

export interface WildcardBoardPiece {
  kind: 'wildcard';
  pieceType: PieceType;
}

export interface CrossClearBoardPiece {
  kind: 'cross-clear';
  pieceType: PieceType;
}

/** @deprecated Legacy persisted kind; normalize to CrossClearBoardPiece. */
export type AreaClearBoardPiece = CrossClearBoardPiece;

export type SpecialBoardPiece = LineClearBoardPiece | WildcardBoardPiece | CrossClearBoardPiece;

export type BoardPiece = StandardBoardPiece | SpecialBoardPiece;

export interface MatchRun {
  orientation: MatchOrientation;
  pieceType: PieceType;
  coordinates: BoardCoordinate[];
}

export interface MatchDetectionResult {
  runs: MatchRun[];
  matchedCoordinates: BoardCoordinate[];
}

export type StructuralSwapFailureReason =
  | 'first-coordinate-out-of-bounds'
  | 'second-coordinate-out-of-bounds'
  | 'first-coordinate-unavailable'
  | 'second-coordinate-unavailable'
  | 'same-coordinate'
  | 'not-adjacent';

export interface StructuralSwapValidationResult {
  isValid: boolean;
  reason?: StructuralSwapFailureReason;
}

export type ScoringSwapFailureReason =
  'structurally-invalid' | 'cell-unavailable' | 'no-match-created';

export type PlayableSwapFailureReason = ScoringSwapFailureReason;

export interface ScoringSwapValidationResult {
  isValid: boolean;
  board: import('./Board').Board;
  reason?: ScoringSwapFailureReason;
  structuralReason?: StructuralSwapFailureReason;
  swappedBoard?: import('./Board').Board;
  matchResult?: MatchDetectionResult;
}

export type PlayableSwapKind = 'ordinary-match' | 'wildcard-swap' | 'special-combination';

export type SpecialActivationReason = 'matched' | 'direct-swap' | 'chain-reaction';

export interface WildcardActivationTarget {
  mode: 'piece-type' | 'entire-board';
  pieceType?: PieceType;
}

export interface SpecialActivationTrigger {
  coordinate: BoardCoordinate;
  reason: SpecialActivationReason;
  wildcardTarget?: WildcardActivationTarget;
}

export interface SpecialActivationEvent {
  index: number;
  coordinate: BoardCoordinate;
  piece: SpecialBoardPiece;
  reason: SpecialActivationReason;
  wildcardTarget?: WildcardActivationTarget;
  affectedCoordinates: BoardCoordinate[];
  newlyTriggeredSpecialCoordinates: BoardCoordinate[];
}

export interface SpecialActivationResult {
  events: SpecialActivationEvent[];
  affectedCoordinates: BoardCoordinate[];
}

export interface PlayableSwap {
  from: BoardCoordinate;
  to: BoardCoordinate;
  kind: PlayableSwapKind;
}

export interface PlayableSwapValidationResult {
  isValid: boolean;
  board: import('./Board').Board;
  reason?: PlayableSwapFailureReason;
  structuralReason?: StructuralSwapFailureReason;
  swappedBoard?: import('./Board').Board;
  ordinaryMatchResult?: MatchDetectionResult;
  kind?: PlayableSwapKind;
  directActivationTriggers?: SpecialActivationTrigger[];
}

export interface GenerateBoardInput {
  rows: number;
  columns: number;
  pieceTypes: readonly string[];
  seed: number;
}

export type ResolvableCell = BoardPiece | null;
export type ResolvableGrid = ResolvableCell[][];

export interface RefillPlacement {
  coordinate: BoardCoordinate;
  piece: StandardBoardPiece;
}

export interface RefillBoardResult {
  board: import('./Board').Board;
  placements: RefillPlacement[];
}

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

export interface CascadeStep {
  index: number;
  cause: ResolutionStepCause;
  boardBeforeResolution: import('./Board').Board;
  boardBeforeRemoval: import('./Board').Board;
  matches: MatchDetectionResult;
  matchPlanning: MatchPlanningResult;
  initialActivationTriggers: SpecialActivationTrigger[];
  activationEvents: SpecialActivationEvent[];
  totalAffectedCoordinates: BoardCoordinate[];
  actualRemovedCoordinates: BoardCoordinate[];
  createdSpecialPieces: AppliedSpecialCreation[];
  removedCoordinates: BoardCoordinate[];
  gridAfterRemoval: ResolvableGrid;
  gridAfterRemovalAndCreation: ResolvableGrid;
  gridAfterGravity: ResolvableGrid;
  refillPlacements: RefillPlacement[];
  boardAfterRefill: import('./Board').Board;
}

export interface SuccessfulCascadeResolutionResult {
  isValid: true;
  initialBoard: import('./Board').Board;
  boardAfterSwap: import('./Board').Board;
  swap: {
    from: BoardCoordinate;
    to: BoardCoordinate;
  };
  steps: CascadeStep[];
  finalBoard: import('./Board').Board;
  cascadeCount: number;
}

export interface RejectedCascadeResolutionResult {
  isValid: false;
  initialBoard: import('./Board').Board;
  finalBoard: import('./Board').Board;
  swap: {
    from: BoardCoordinate;
    to: BoardCoordinate;
  };
  reason: ScoringSwapFailureReason;
  structuralReason?: StructuralSwapFailureReason;
}

export type CascadeResolutionResult =
  SuccessfulCascadeResolutionResult | RejectedCascadeResolutionResult;

export interface ResolveCascadeInput {
  board: import('./Board').Board;
  first: BoardCoordinate;
  second: BoardCoordinate;
  pieceTypes: readonly string[];
  unavailableCoordinates?: readonly BoardCoordinate[];
  seed?: number;
  randomSource?: RandomSource;
  maxCascadeSteps?: number;
  maxSpecialActivations?: number;
}

export type ResolutionStepCause = 'ordinary-match' | 'direct-special-swap' | 'cascade';

export interface ValidScoringSwap {
  from: BoardCoordinate;
  to: BoardCoordinate;
}

export type PieceInventoryKey = string;

export type ExactPieceInventory = Record<PieceInventoryKey, number>;

export type PieceInventory = ExactPieceInventory;

export interface ReshuffleDeadBoardInput {
  board: import('./Board').Board;
  unavailableCoordinates?: readonly BoardCoordinate[];
  seed?: number;
  randomSource?: RandomSource;
  maxRandomAttempts?: number;
  maxSearchNodes?: number;
}

/** Shared rearrange input; accepts stable or unstable boards. */
export type RearrangeBoardToStablePlayableInput = ReshuffleDeadBoardInput;

export interface ReshuffleResult {
  originalBoard: import('./Board').Board;
  reshuffledBoard: import('./Board').Board;
  originalInventory: PieceInventory;
  reshuffledInventory: PieceInventory;
  seed?: number;
  randomAttempts: number;
  fallbackSearchUsed: boolean;
  searchNodesVisited: number;
  validScoringSwaps: ValidScoringSwap[];
  validPlayableSwaps: PlayableSwap[];
}

export interface MatchGroupBounds {
  minRow: number;
  minColumn: number;
  maxRow: number;
  maxColumn: number;
}

export interface MatchGroup {
  pieceType: PieceType;
  runs: MatchRun[];
  coordinates: BoardCoordinate[];
  bounds: MatchGroupBounds;
}

export type MatchShape =
  | 'straight-3'
  | 'straight-4'
  | 'straight-5-plus'
  | 'l-shape'
  | 't-shape'
  | 'cross-shape'
  | 'complex';

export interface ClassifiedMatchGroup {
  group: MatchGroup;
  shape: MatchShape;
  primaryOrientation?: MatchOrientation;
  pivotCoordinates: BoardCoordinate[];
  maximumRunLength: number;
}

export type SpecialPieceKind = 'line-clear' | 'wildcard' | 'cross-clear';

export interface PlannedSpecialPiece {
  kind: SpecialPieceKind;
  pieceType: PieceType;
  orientation?: MatchOrientation;
}

export interface SpecialCreationContext {
  swap?: {
    from: BoardCoordinate;
    to: BoardCoordinate;
  };
}

export interface SpecialPieceCreationPlan {
  groupIndex: number;
  sourcePieceType: PieceType;
  matchShape: MatchShape;
  creationCoordinate: BoardCoordinate;
  specialPiece: PlannedSpecialPiece;
  consumedCoordinates: BoardCoordinate[];
  group: ClassifiedMatchGroup;
}

export interface MatchPlanningResult {
  groups: ClassifiedMatchGroup[];
  specialCreations: SpecialPieceCreationPlan[];
}

export interface AppliedSpecialCreation {
  coordinate: BoardCoordinate;
  piece: BoardPiece;
  sourcePlan: SpecialPieceCreationPlan;
}

export interface ApplyMatchPlanResult {
  gridAfterRemovalAndCreation: ResolvableGrid;
  removedCoordinates: BoardCoordinate[];
  createdSpecialPieces: AppliedSpecialCreation[];
  planning: MatchPlanningResult;
}
