export type BoardDomainErrorCode =
  | 'invalid-level-definition'
  | 'invalid-level-state'
  | 'invalid-objective-definition'
  | 'duplicate-objective-id'
  | 'invalid-scoring-rules'
  | 'score-overflow'
  | 'level-state-mismatch'
  | 'invalid-derived-seed'
  | 'invalid-board-dimensions'
  | 'coordinate-out-of-bounds'
  | 'empty-piece-types'
  | 'invalid-piece-type'
  | 'invalid-seed'
  | 'same-coordinate-swap'
  | 'generation-impossible'
  | 'malformed-grid'
  | 'invalid-resolvable-grid'
  | 'invalid-cascade-limit'
  | 'cascade-limit-exceeded'
  | 'board-not-stable'
  | 'board-not-dead'
  | 'invalid-reshuffle-limit'
  | 'reshuffle-search-exhausted'
  | 'invalid-match-run'
  | 'invalid-match-group'
  | 'invalid-special-piece-plan'
  | 'invalid-board-piece'
  | 'invalid-special-piece'
  | 'conflicting-creation-coordinates'
  | 'invalid-special-activation-trigger'
  | 'invalid-wildcard-target'
  | 'invalid-special-activation-limit'
  | 'special-activation-limit-exceeded';

export class BoardDomainError extends Error {
  public readonly code: BoardDomainErrorCode;

  public constructor(code: BoardDomainErrorCode, message: string) {
    super(message);
    this.name = 'BoardDomainError';
    this.code = code;
  }
}
