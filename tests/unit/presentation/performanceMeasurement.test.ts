import { describe, expect, it } from 'vitest';
import {
  calculateAverageFrameMs,
  calculatePercentile,
  countLongFrames,
  createPerformanceSample,
} from '../../../src/game/presentation/testing/performanceMeasurement';

const resources = {
  displayObjects: 70,
  boardPieces: 64,
  temporaryObjects: 0,
  activeTweens: 0,
  activeTimers: 0,
  listeners: 4,
};

describe('performanceMeasurement', () => {
  it('calculates averages, percentiles, and long-frame counts', () => {
    const frames = [10, 20, 33, 34, 51, 101];
    expect(calculateAverageFrameMs(frames)).toBe(41.5);
    expect(calculatePercentile(frames, 0.95)).toBe(101);
    expect(countLongFrames(frames, 33)).toBe(3);
    expect(countLongFrames(frames, 50)).toBe(2);
    expect(countLongFrames(frames, 100)).toBe(1);
  });

  it('handles empty and one-frame inputs', () => {
    expect(calculateAverageFrameMs([])).toBe(0);
    expect(calculatePercentile([], 0.95)).toBe(0);
    expect(calculatePercentile([16], 0.95)).toBe(16);
  });

  it('creates stable, serializable samples without unsupported heap fields', () => {
    const sample = createPerformanceSample({
      scenarioId: 'fast-gravity',
      buildKind: 'development',
      viewport: { width: 1280, height: 720, devicePixelRatio: 1 },
      playbackMode: 'fast',
      reducedMotion: false,
      frameDurations: [16, 17, 40],
      playbackDurationMs: 100,
      resourcesBefore: resources,
      resourcesAfter: resources,
    });

    expect(sample).toMatchObject({
      frameCount: 3,
      averageFrameMs: 73 / 3,
      percentile95FrameMs: 40,
      framesOver33Ms: 1,
      framesOver50Ms: 0,
      framesOver100Ms: 0,
    });
    expect('heapBeforeBytes' in sample).toBe(false);
    expect(JSON.parse(JSON.stringify(sample))).toEqual(sample);
  });
});