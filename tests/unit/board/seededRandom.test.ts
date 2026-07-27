import { describe, expect, it } from 'vitest';
import { BoardDomainError } from '../../../src/game/board/errors';
import { SeededRandom } from '../../../src/game/board/seededRandom';

describe('SeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const first = new SeededRandom(12345);
    const second = new SeededRandom(12345);

    const firstSequence = [
      first.nextFloat(),
      first.nextFloat(),
      first.nextFloat(),
      first.nextFloat(),
    ];
    const secondSequence = [
      second.nextFloat(),
      second.nextFloat(),
      second.nextFloat(),
      second.nextFloat(),
    ];

    expect(firstSequence).toEqual(secondSequence);
  });

  it('produces different sequences for different seeds', () => {
    const first = new SeededRandom(100);
    const second = new SeededRandom(101);

    const firstSequence = [first.nextFloat(), first.nextFloat(), first.nextFloat()];
    const secondSequence = [second.nextFloat(), second.nextFloat(), second.nextFloat()];

    expect(firstSequence).not.toEqual(secondSequence);
  });

  it('returns bounded integers', () => {
    const random = new SeededRandom(42);

    for (let index = 0; index < 100; index += 1) {
      const value = random.nextInt(6);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
    }
  });

  it('picks deterministically from an allowed list', () => {
    const first = new SeededRandom(9876);
    const second = new SeededRandom(9876);
    const pieces = ['ruby', 'sapphire', 'emerald'] as const;

    const firstPicks = [first.pickFrom(pieces), first.pickFrom(pieces), first.pickFrom(pieces)];
    const secondPicks = [second.pickFrom(pieces), second.pickFrom(pieces), second.pickFrom(pieces)];

    expect(firstPicks).toEqual(secondPicks);
  });

  it('rejects invalid seeds', () => {
    expect(() => new SeededRandom(Number.NaN)).toThrowError(BoardDomainError);
    expect(() => new SeededRandom(3.14)).toThrowError(BoardDomainError);
  });
});
