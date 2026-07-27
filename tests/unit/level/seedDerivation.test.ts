import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../../../src/game/board/seededRandom';
import { BoardDomainError } from '../../../src/game/board/errors';
import { deriveLevelSeed } from '../../../src/game/level';

describe('deriveLevelSeed', () => {
  it('returns deterministic seed for same input', () => {
    const first = deriveLevelSeed({
      baseSeed: 12345,
      acceptedMoveIndex: 2,
      purpose: 'move-resolution',
    });

    const second = deriveLevelSeed({
      baseSeed: 12345,
      acceptedMoveIndex: 2,
      purpose: 'move-resolution',
    });

    expect(first).toBe(second);
  });

  it('changes output by move index and purpose', () => {
    const base = 12345;
    const move0 = deriveLevelSeed({
      baseSeed: base,
      acceptedMoveIndex: 0,
      purpose: 'move-resolution',
    });
    const move1 = deriveLevelSeed({
      baseSeed: base,
      acceptedMoveIndex: 1,
      purpose: 'move-resolution',
    });
    const reshuffle = deriveLevelSeed({
      baseSeed: base,
      acceptedMoveIndex: 0,
      purpose: 'post-move-reshuffle',
    });

    expect(move0).not.toBe(move1);
    expect(move0).not.toBe(reshuffle);
  });

  it('produces seeds compatible with SeededRandom', () => {
    const seed = deriveLevelSeed({
      baseSeed: 99,
      acceptedMoveIndex: 10,
      purpose: 'initial-reshuffle',
    });

    const random = new SeededRandom(seed);
    const value = random.nextInt(10);

    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(10);
  });

  it('rejects invalid base seed and move index', () => {
    expect(() =>
      deriveLevelSeed({
        baseSeed: Number.NaN,
        acceptedMoveIndex: 0,
        purpose: 'move-resolution',
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      deriveLevelSeed({
        baseSeed: 10,
        acceptedMoveIndex: -1,
        purpose: 'move-resolution',
      }),
    ).toThrowError(BoardDomainError);
  });
});
