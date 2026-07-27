import { describe, expect, it } from 'vitest';
import { BoardDomainError } from '../../../src/game/board';
import {
  getEffectIntensity,
  getGravityDuration,
  getPlaybackDurations,
  getRefillDuration,
  getReshuffleDuration,
  getScoreCountDuration,
  getSpecialEffectDuration,
} from '../../../src/game/presentation/playback/playbackTimings';

describe('playbackTimings', () => {
  it('returns normal durations', () => {
    const durations = getPlaybackDurations({ mode: 'normal', reducedMotion: false });

    expect(durations.swap).toBe(180);
    expect(durations.cascadePause).toBe(100);
    expect(durations.lineClearBeamBase).toBe(120);
    expect(getGravityDuration(3, { mode: 'normal', reducedMotion: false })).toBe(235);
    expect(getRefillDuration(2, { mode: 'normal', reducedMotion: false })).toBe(190);
    expect(getReshuffleDuration(3, { mode: 'normal', reducedMotion: false })).toBe(244);
  });

  it('returns fast durations at approximately half speed', () => {
    const normal = getPlaybackDurations({ mode: 'normal', reducedMotion: false });
    const fast = getPlaybackDurations({ mode: 'fast', reducedMotion: false });

    expect(fast.swap).toBe(normal.swap / 2);
    expect(fast.removal).toBe(normal.removal / 2);
    expect(fast.summaryVisible).toBe(normal.summaryVisible / 2);
    expect(fast.lineClearBeamBase).toBe(normal.lineClearBeamBase / 2);
  });

  it('returns instant durations as zero while preserving valid non-negative values', () => {
    const instant = getPlaybackDurations({ mode: 'instant', reducedMotion: false });

    expect(Object.values(instant).every((value) => value === 0)).toBe(true);
    expect(getGravityDuration(5, { mode: 'instant', reducedMotion: false })).toBe(0);
    expect(getRefillDuration(5, { mode: 'instant', reducedMotion: false })).toBe(0);
    expect(getScoreCountDuration(4, { mode: 'instant', reducedMotion: false })).toBe(0);
  });

  it('applies reduced-motion substitutions without producing negative durations', () => {
    const reduced = getPlaybackDurations({ mode: 'normal', reducedMotion: true });

    expect(reduced.swap).toBeLessThanOrEqual(90);
    expect(reduced.removal).toBeLessThanOrEqual(90);
    expect(reduced.lineClearBeamBase).toBe(0);
    expect(reduced.cascadePause).toBe(0);
    expect(getEffectIntensity({ mode: 'normal', reducedMotion: true })).toBe('reduced');
    expect(Object.values(reduced).every((value) => value >= 0)).toBe(true);
  });

  it('derives special-effect and score-counter durations without negative values', () => {
    expect(
      getSpecialEffectDuration({
        kind: 'line-clear-horizontal',
        affectedCount: 5,
        activationIndex: 0,
        settings: { mode: 'normal', reducedMotion: false },
      }),
    ).toBe(260);
    expect(
      getSpecialEffectDuration({
        kind: 'wildcard-full-board',
        affectedCount: 64,
        activationIndex: 6,
        settings: { mode: 'fast', reducedMotion: false },
      }),
    ).toBeGreaterThanOrEqual(0);
    expect(getScoreCountDuration(3, { mode: 'normal', reducedMotion: false })).toBe(190);
  });

  it('rejects invalid playback modes', () => {
    expect(() =>
      getPlaybackDurations({
        mode: 'slow' as 'normal',
        reducedMotion: false,
      }),
    ).toThrowError(BoardDomainError);
  });
});
