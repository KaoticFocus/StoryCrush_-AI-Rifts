import { BoardDomainError } from './errors';

const UINT32_MAX_PLUS_ONE = 0x1_0000_0000;

export class SeededRandom {
  private state: number;

  public constructor(seed: number) {
    if (!Number.isInteger(seed)) {
      throw new BoardDomainError(
        'invalid-seed',
        `seed must be an integer; received ${String(seed)}`,
      );
    }

    this.state = seed >>> 0;
  }

  public nextFloat(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_MAX_PLUS_ONE;
  }

  public nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new BoardDomainError(
        'invalid-seed',
        `maxExclusive must be an integer greater than zero; received ${String(maxExclusive)}`,
      );
    }

    return Math.floor(this.nextFloat() * maxExclusive);
  }

  public pickFrom<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new BoardDomainError('empty-piece-types', 'cannot pick from an empty list');
    }

    return values[this.nextInt(values.length)];
  }
}
