import { describe, expect, it } from 'vitest';
import { resolveCascade } from '../../../src/game/board/resolveCascade';
import { BoardDomainError } from '../../../src/game/board/errors';
import { DEFAULT_SCORING_RULES, calculateResolutionScore } from '../../../src/game/level';
import {
  boardFromPieces,
  lineClearPiece,
  standardBoard,
  standardPiece,
  wildcardPiece,
} from '../board/boardTestHelpers';

class ScriptedRandom {
  private index = 0;

  public constructor(private readonly values: number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index] ?? 0;
    this.index += 1;
    return value % maxExclusive;
  }
}

function expectValidResolution(result: ReturnType<typeof resolveCascade>) {
  expect(result.isValid).toBe(true);
  if (!result.isValid) {
    throw new Error('Expected valid resolution');
  }

  return result;
}

describe('calculateResolutionScore', () => {
  it('scores first-step ordinary match with multiplier x1', () => {
    const resolution = expectValidResolution(
      resolveCascade({
        board: standardBoard([
          ['ruby', 'sapphire', 'ruby'],
          ['topaz', 'ruby', 'emerald'],
          ['amethyst', 'pearl', 'topaz'],
        ]),
        first: { row: 0, column: 1 },
        second: { row: 1, column: 1 },
        pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
        randomSource: new ScriptedRandom([0, 1, 2]),
      }),
    );

    const score = calculateResolutionScore({ resolution, rules: DEFAULT_SCORING_RULES });

    expect(score.events[0]).toMatchObject({
      kind: 'piece-clear',
      stepIndex: 0,
      removedCount: 3,
      multiplier: 1,
      awardedPoints: 30,
    });
    expect(score.totalAwardedPoints).toBe(30);
  });

  it('applies activation bonuses and cascade multipliers in deterministic order', () => {
    const resolution = expectValidResolution(
      resolveCascade({
        board: boardFromPieces([
          [wildcardPiece('ruby'), lineClearPiece('sapphire', 'vertical')],
          [lineClearPiece('sapphire', 'horizontal'), standardPiece('topaz')],
        ]),
        first: { row: 0, column: 0 },
        second: { row: 0, column: 1 },
        pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
        randomSource: new ScriptedRandom([0, 1, 2, 3]),
      }),
    );

    const score = calculateResolutionScore({ resolution, rules: DEFAULT_SCORING_RULES });
    const activationEvents = score.events.filter((event) => event.kind === 'special-activation');

    expect(activationEvents.length).toBeGreaterThanOrEqual(2);
    expect(score.events[0].kind).toBe('piece-clear');
    expect(score.pieceClearSubtotal + score.specialActivationSubtotal).toBe(
      score.totalAwardedPoints,
    );
  });

  it('does not score protected creation coordinates as removed and does not score creation itself', () => {
    const resolution = expectValidResolution(
      resolveCascade({
        board: standardBoard([
          ['ruby', 'ruby', 'sapphire', 'ruby'],
          ['topaz', 'amethyst', 'ruby', 'emerald'],
        ]),
        first: { row: 0, column: 2 },
        second: { row: 1, column: 2 },
        pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
        randomSource: new ScriptedRandom([0, 1, 2]),
      }),
    );

    const step0 = resolution.steps[0];
    expect(step0.matches.matchedCoordinates.length).toBe(4);
    expect(step0.actualRemovedCoordinates.length).toBe(3);
    expect(step0.createdSpecialPieces.length).toBe(1);

    const score = calculateResolutionScore({ resolution, rules: DEFAULT_SCORING_RULES });
    const pieceEvent = score.events.find((event) => event.kind === 'piece-clear');

    expect(pieceEvent).toMatchObject({ removedCount: 3, awardedPoints: 30 });
  });

  it('throws on score overflow', () => {
    const resolution = expectValidResolution(
      resolveCascade({
        board: standardBoard([
          ['ruby', 'sapphire', 'ruby'],
          ['topaz', 'ruby', 'emerald'],
          ['amethyst', 'pearl', 'topaz'],
        ]),
        first: { row: 0, column: 1 },
        second: { row: 1, column: 1 },
        pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
        randomSource: new ScriptedRandom([0, 1, 2]),
      }),
    );

    expect(() =>
      calculateResolutionScore({
        resolution,
        rules: {
          ...DEFAULT_SCORING_RULES,
          pointsPerRemovedPiece: Number.MAX_SAFE_INTEGER,
          lineClearActivationBonus: Number.MAX_SAFE_INTEGER,
          areaClearActivationBonus: Number.MAX_SAFE_INTEGER,
          wildcardActivationBonus: Number.MAX_SAFE_INTEGER,
        },
      }),
    ).toThrowError(BoardDomainError);
  });
});
