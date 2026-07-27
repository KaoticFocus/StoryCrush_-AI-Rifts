import { describe, expect, it } from 'vitest';
import { clamp } from '../../src/utils/clamp';

describe('clamp', () => {
  it('returns values inside the range unchanged', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps values below the range', () => {
    expect(clamp(-2, 0, 10)).toBe(0);
  });

  it('clamps values above the range', () => {
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('handles boundary values', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('throws when min is greater than max', () => {
    expect(() => clamp(5, 10, 0)).toThrowError('min must be less than or equal to max');
  });
});
