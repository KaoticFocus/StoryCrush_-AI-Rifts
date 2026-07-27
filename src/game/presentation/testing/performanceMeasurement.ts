import { type PlaybackMode } from '../playback/playbackTypes';

export interface PerformanceResourceSnapshot {
  displayObjects: number;
  boardPieces: number;
  temporaryObjects: number;
  activeTweens: number;
  activeTimers: number;
  listeners: number;
}

export interface PerformanceSample {
  scenarioId: string;
  buildKind: 'development' | 'preview';
  viewport: { width: number; height: number; devicePixelRatio: number };
  playbackMode: PlaybackMode;
  reducedMotion: boolean;
  frameCount: number;
  averageFrameMs: number;
  percentile95FrameMs: number;
  longestFrameMs: number;
  framesOver33Ms: number;
  framesOver50Ms: number;
  framesOver100Ms: number;
  playbackDurationMs: number;
  resourcesBefore: PerformanceResourceSnapshot;
  resourcesAfter: PerformanceResourceSnapshot;
  heapBeforeBytes?: number;
  heapAfterBytes?: number;
}

export function calculateAverageFrameMs(frameDurations: readonly number[]): number {
  if (frameDurations.length === 0) return 0;
  return frameDurations.reduce((total, duration) => total + duration, 0) / frameDurations.length;
}

export function calculatePercentile(frameDurations: readonly number[], percentile: number): number {
  if (frameDurations.length === 0) return 0;
  const sorted = [...frameDurations].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentile) - 1));
  return sorted[index];
}

export function countLongFrames(frameDurations: readonly number[], thresholdMs: number): number {
  return frameDurations.filter((duration) => duration > thresholdMs).length;
}

export function createPerformanceSample(
  input: Omit<
    PerformanceSample,
    | 'frameCount'
    | 'averageFrameMs'
    | 'percentile95FrameMs'
    | 'longestFrameMs'
    | 'framesOver33Ms'
    | 'framesOver50Ms'
    | 'framesOver100Ms'
  > & { frameDurations: readonly number[] },
): PerformanceSample {
  const frameDurations = input.frameDurations.filter(
    (duration) => Number.isFinite(duration) && duration >= 0,
  );
  return {
    scenarioId: input.scenarioId,
    buildKind: input.buildKind,
    viewport: { ...input.viewport },
    playbackMode: input.playbackMode,
    reducedMotion: input.reducedMotion,
    frameCount: frameDurations.length,
    averageFrameMs: calculateAverageFrameMs(frameDurations),
    percentile95FrameMs: calculatePercentile(frameDurations, 0.95),
    longestFrameMs: frameDurations.length === 0 ? 0 : Math.max(...frameDurations),
    framesOver33Ms: countLongFrames(frameDurations, 33),
    framesOver50Ms: countLongFrames(frameDurations, 50),
    framesOver100Ms: countLongFrames(frameDurations, 100),
    playbackDurationMs: input.playbackDurationMs,
    resourcesBefore: { ...input.resourcesBefore },
    resourcesAfter: { ...input.resourcesAfter },
    ...(input.heapBeforeBytes === undefined ? {} : { heapBeforeBytes: input.heapBeforeBytes }),
    ...(input.heapAfterBytes === undefined ? {} : { heapAfterBytes: input.heapAfterBytes }),
  };
}

export class AnimationFrameMeasurement {
  private readonly frameDurations: number[] = [];
  private frameHandle: number | null = null;
  private previousFrameTime: number | null = null;
  private startedAt = 0;

  public constructor(private readonly enabled: boolean, private readonly maxFrames = 2_000) {}

  public start(now = performance.now()): void {
    if (!this.enabled || this.frameHandle !== null) return;
    this.startedAt = now;
    this.previousFrameTime = now;
    const observe = (timestamp: number) => {
      if (this.frameHandle === null) return;
      if (this.previousFrameTime !== null && this.frameDurations.length < this.maxFrames) {
        this.frameDurations.push(timestamp - this.previousFrameTime);
      }
      this.previousFrameTime = timestamp;
      this.frameHandle = window.requestAnimationFrame(observe);
    };
    this.frameHandle = window.requestAnimationFrame(observe);
  }

  public stop(now = performance.now()): { frameDurations: readonly number[]; durationMs: number } {
    if (this.frameHandle !== null) window.cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
    return { frameDurations: [...this.frameDurations], durationMs: Math.max(0, now - this.startedAt) };
  }
}