import { BoardPiece, SpecialActivationReason, WildcardActivationTarget } from './boardTypes';
import { isWildcardPiece } from './boardPieces';
import { BoardDomainError } from './errors';

export interface DetermineWildcardTargetInput {
  wildcardPiece: BoardPiece;
  reason: SpecialActivationReason;
  swapCounterpartPiece?: BoardPiece;
}

export function determineWildcardTarget(
  input: DetermineWildcardTargetInput,
): WildcardActivationTarget {
  if (!isWildcardPiece(input.wildcardPiece)) {
    throw new BoardDomainError(
      'invalid-wildcard-target',
      'determineWildcardTarget requires a wildcard board piece',
    );
  }

  if (input.reason === 'direct-swap') {
    if (!input.swapCounterpartPiece) {
      throw new BoardDomainError(
        'invalid-wildcard-target',
        'direct-swap wildcard activation requires a swap counterpart piece',
      );
    }

    if (isWildcardPiece(input.swapCounterpartPiece)) {
      return { mode: 'entire-board' };
    }

    return {
      mode: 'piece-type',
      pieceType: input.swapCounterpartPiece.pieceType,
    };
  }

  return {
    mode: 'piece-type',
    pieceType: input.wildcardPiece.pieceType,
  };
}
