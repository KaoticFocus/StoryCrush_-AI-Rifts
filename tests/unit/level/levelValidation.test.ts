import { describe, expect, it } from 'vitest';
import { BoardDomainError } from '../../../src/game/board/errors';
import {
  DEFAULT_SCORING_RULES,
  validateLevelDefinition,
  validateScoringRules,
} from '../../../src/game/level';
import type { LevelDefinition } from '../../../src/game/level';

function validDefinition(): LevelDefinition {
  return {
    id: 'level-1',
    moveLimit: 12,
    allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald'],
    objectives: [
      { id: 'score-main', kind: 'score' as const, targetScore: 100 },
      {
        id: 'collect-ruby',
        kind: 'collect-piece' as const,
        pieceType: 'ruby' as const,
        targetCount: 4,
      },
    ],
    scoring: { ...DEFAULT_SCORING_RULES },
    seed: 1234,
  };
}

describe('validateLevelDefinition', () => {
  it('accepts a valid definition and returns a defensive clone', () => {
    const definition = validDefinition();
    const validated = validateLevelDefinition(definition);

    expect(validated).toEqual(definition);
    expect(validated).not.toBe(definition);
    expect(validated.objectives).not.toBe(definition.objectives);
  });

  it('rejects empty id, invalid moveLimit, empty refill types, empty objectives, and invalid seed', () => {
    expect(() => validateLevelDefinition({ ...validDefinition(), id: '  ' })).toThrowError(
      BoardDomainError,
    );
    expect(() => validateLevelDefinition({ ...validDefinition(), moveLimit: 0 })).toThrowError(
      BoardDomainError,
    );
    expect(() =>
      validateLevelDefinition({ ...validDefinition(), allowedRefillPieceTypes: [] as never[] }),
    ).toThrowError(BoardDomainError);
    expect(() => validateLevelDefinition({ ...validDefinition(), objectives: [] })).toThrowError(
      BoardDomainError,
    );
    expect(() => validateLevelDefinition({ ...validDefinition(), seed: Number.NaN })).toThrowError(
      BoardDomainError,
    );
  });

  it('rejects invalid piece types, duplicate objective ids, and invalid objective targets', () => {
    expect(() =>
      validateLevelDefinition({
        ...validDefinition(),
        allowedRefillPieceTypes: ['ruby', 'bad-piece'] as never,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      validateLevelDefinition({
        ...validDefinition(),
        objectives: [
          { id: 'dup', kind: 'score', targetScore: 100 },
          { id: 'dup', kind: 'collect-piece', pieceType: 'ruby', targetCount: 1 },
        ],
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      validateLevelDefinition({
        ...validDefinition(),
        objectives: [{ id: 'score-main', kind: 'score', targetScore: 0 }],
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      validateLevelDefinition({
        ...validDefinition(),
        objectives: [
          {
            id: 'collect-ruby',
            kind: 'collect-piece',
            pieceType: 'ruby',
            targetCount: -1,
          },
        ],
      }),
    ).toThrowError(BoardDomainError);
  });
});

describe('validateScoringRules', () => {
  it('accepts valid integer rules and rejects invalid values', () => {
    expect(validateScoringRules({ ...DEFAULT_SCORING_RULES })).toEqual(DEFAULT_SCORING_RULES);

    expect(() =>
      validateScoringRules({
        ...DEFAULT_SCORING_RULES,
        pointsPerRemovedPiece: 0,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      validateScoringRules({
        ...DEFAULT_SCORING_RULES,
        wildcardActivationBonus: -1,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      validateScoringRules({
        ...DEFAULT_SCORING_RULES,
        cascadeMultiplierIncrement: -1,
      }),
    ).toThrowError(BoardDomainError);
  });
});
