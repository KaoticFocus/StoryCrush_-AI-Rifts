import { Board } from './Board';
import {
  BoardCoordinate,
  PlayableSwapValidationResult,
  SpecialActivationTrigger,
} from './boardTypes';
import { isSpecialPiece, isWildcardPiece } from './boardPieces';
import { validateScoringSwap, validateStructuralSwap } from './swapValidation';
import { determineWildcardTarget } from './wildcardTargeting';

function cloneCoordinate(coordinate: BoardCoordinate): BoardCoordinate {
  return { row: coordinate.row, column: coordinate.column };
}

export function validatePlayableSwap(
  board: Board,
  first: BoardCoordinate,
  second: BoardCoordinate,
  unavailableCoordinates: readonly BoardCoordinate[] = [],
): PlayableSwapValidationResult {
  const structural = validateStructuralSwap(board, first, second, unavailableCoordinates);
  if (!structural.isValid) {
    const isUnavailable =
      structural.reason === 'first-coordinate-unavailable' ||
      structural.reason === 'second-coordinate-unavailable';
    return {
      isValid: false,
      reason: isUnavailable ? 'cell-unavailable' : 'structurally-invalid',
      structuralReason: structural.reason,
      board,
    };
  }

  const firstPiece = board.getPieceAt(first);
  const secondPiece = board.getPieceAt(second);
  const scoring = validateScoringSwap(board, first, second, unavailableCoordinates);

  const hasWildcard = isWildcardPiece(firstPiece) || isWildcardPiece(secondPiece);
  const hasSpecialCombination = isSpecialPiece(firstPiece) && isSpecialPiece(secondPiece);
  const hasDirectSpecialActivation = hasWildcard || hasSpecialCombination;

  if (!scoring.isValid && !hasDirectSpecialActivation) {
    return {
      isValid: false,
      reason: 'no-match-created',
      board,
      swappedBoard: scoring.swappedBoard,
      ordinaryMatchResult: scoring.matchResult,
    };
  }

  const swappedBoard = scoring.swappedBoard ?? board.swapPieces(first, second);

  const kind = hasWildcard
    ? 'wildcard-swap'
    : hasSpecialCombination
      ? 'special-combination'
      : 'ordinary-match';

  const directActivationTriggers: SpecialActivationTrigger[] = [];
  const destinationPiece = swappedBoard.getPieceAt(second);
  const sourcePiece = swappedBoard.getPieceAt(first);

  if (isSpecialPiece(destinationPiece)) {
    directActivationTriggers.push({
      coordinate: cloneCoordinate(second),
      reason: 'direct-swap',
      wildcardTarget: isWildcardPiece(destinationPiece)
        ? determineWildcardTarget({
            wildcardPiece: destinationPiece,
            reason: 'direct-swap',
            swapCounterpartPiece: sourcePiece,
          })
        : undefined,
    });
  }

  if (isSpecialPiece(sourcePiece)) {
    directActivationTriggers.push({
      coordinate: cloneCoordinate(first),
      reason: 'direct-swap',
      wildcardTarget: isWildcardPiece(sourcePiece)
        ? determineWildcardTarget({
            wildcardPiece: sourcePiece,
            reason: 'direct-swap',
            swapCounterpartPiece: destinationPiece,
          })
        : undefined,
    });
  }

  return {
    isValid: true,
    board: swappedBoard,
    swappedBoard,
    ordinaryMatchResult: scoring.matchResult,
    kind,
    directActivationTriggers,
  };
}
