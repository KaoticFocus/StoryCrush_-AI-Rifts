export { Board } from './Board';
export { applyGravity } from './applyGravity';
export { applyMatchPlanning } from './applyMatchPlanning';
export { assertStableBoard, isDeadBoard } from './deadBoard';
export { generateBoard } from './generateBoard';
export { findMatchRuns } from './matchDetection';
export { validatePlayableSwap } from './playableSwapValidation';
export {
  classifyMatchGroup,
  classifyMatchGroups,
  findMatchGroupPivots,
  groupMatchRuns,
} from './matchGroups';
export {
  createEmptyPieceInventory,
  createPieceInventory,
  getPieceInventoryKey,
  inventoryTotal,
  parsePieceInventoryKey,
} from './pieceInventory';
export { refillBoard } from './refillBoard';
export { removeMatchedCoordinates } from './removeMatches';
export {
  DEFAULT_RESHUFFLE_RANDOM_ATTEMPTS,
  DEFAULT_RESHUFFLE_SEARCH_NODES,
  reshuffleDeadBoard,
} from './reshuffleBoard';
export { DEFAULT_MAX_CASCADE_STEPS, resolveCascade } from './resolveCascade';
export {
  boardToResolvableGrid,
  resolvableGridToBoard,
  validateResolvableGrid,
} from './resolutionGrid';
export { planSpecialPieceCreations, selectSpecialCreationCoordinate } from './specialPiecePlanning';
export { SeededRandom } from './seededRandom';
export {
  createAreaClearPiece,
  createBoardPieceFromPlan,
  createLineClearPiece,
  createStandardPiece,
  createWildcardPiece,
  getPieceType,
  isAreaClearPiece,
  isLineClearPiece,
  isSpecialPiece,
  isStandardPiece,
  isWildcardPiece,
} from './boardPieces';
export {
  areCoordinatesOrthogonallyAdjacent,
  createsMatchAfterSwap,
  validateScoringSwap,
  validateStructuralSwap,
} from './swapValidation';
export {
  countPlayableSwaps,
  countValidScoringSwaps,
  findPlayableSwaps,
  findValidScoringSwaps,
  hasPlayableSwap,
  hasValidScoringSwap,
} from './validMoves';
export { determineWildcardTarget } from './wildcardTargeting';
export {
  DEFAULT_MAX_SPECIAL_ACTIVATIONS,
  getSpecialActivationEffect,
  resolveSpecialActivations,
} from './specialActivation';
export { validateAllowedPieceTypes, validateBoardDimensions } from './boardValidation';
export { BoardDomainError } from './errors';
export {
  DEFAULT_PIECE_TYPES,
  type AppliedSpecialCreation,
  type ApplyMatchPlanResult,
  type BoardCoordinate,
  type BoardDimensions,
  type BoardPiece,
  type StandardBoardPiece,
  type LineClearBoardPiece,
  type WildcardBoardPiece,
  type AreaClearBoardPiece,
  type SpecialBoardPiece,
  type PieceInventory,
  type PieceInventoryKey,
  type ExactPieceInventory,
  type GenerateBoardInput,
  type MatchDetectionResult,
  type MatchGroup,
  type MatchOrientation,
  type MatchPlanningResult,
  type MatchRun,
  type MatchShape,
  type PlayableSwap,
  type PlayableSwapFailureReason,
  type PlayableSwapKind,
  type PlayableSwapValidationResult,
  type PieceType,
  type CascadeStep,
  type CascadeResolutionResult,
  type ResolutionStepCause,
  type ScoringSwapValidationResult,
  type StructuralSwapFailureReason,
  type StructuralSwapValidationResult,
  type RandomSource,
  type RefillBoardResult,
  type RefillPlacement,
  type ResolvableCell,
  type ResolvableGrid,
  type ResolveCascadeInput,
  type ReshuffleDeadBoardInput,
  type ReshuffleResult,
  type SuccessfulCascadeResolutionResult,
  type RejectedCascadeResolutionResult,
  type ValidScoringSwap,
  type ClassifiedMatchGroup,
  type MatchGroupBounds,
  type PlannedSpecialPiece,
  type SpecialActivationEvent,
  type SpecialActivationReason,
  type SpecialActivationResult,
  type SpecialActivationTrigger,
  type SpecialCreationContext,
  type SpecialPieceCreationPlan,
  type SpecialPieceKind,
  type WildcardActivationTarget,
} from './boardTypes';
