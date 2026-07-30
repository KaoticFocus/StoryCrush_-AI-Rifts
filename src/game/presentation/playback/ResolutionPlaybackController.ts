import { type AcceptedLevelMoveResult, type LevelObjectiveDefinition } from '../../level';
import { type RejectedLevelMoveResult } from '../../level/levelTypes';
import { buildMovePlaybackPlan } from './buildMovePlaybackPlan';
import { type PlaybackSummary, type PlaybackCommand, type PlaybackMode } from './playbackTypes';

export interface PlaybackSettings {
  mode: PlaybackMode;
  reducedMotion: boolean;
}

export interface PlaybackCompletion {
  completed: boolean;
  cancelled: boolean;
  reason: 'completed' | 'cancelled' | 'failed' | 'busy';
}

export interface ResolutionPlaybackAdapter {
  applyInputLock(locked: boolean): void;
  isAuthoritativeTerminal(): boolean;
  getObjectiveDefinitions(): readonly LevelObjectiveDefinition[];
  prepareAcceptedMove(result: AcceptedLevelMoveResult): void;
  prepareRejectedMove(result: RejectedLevelMoveResult): void;
  executeCommand(command: PlaybackCommand, settings: PlaybackSettings): Promise<void> | void;
  playRejectedSwap(
    result: RejectedLevelMoveResult,
    settings: PlaybackSettings,
  ): Promise<void> | void;
  finishAcceptedMove(
    result: AcceptedLevelMoveResult,
    summary: PlaybackSummary,
  ): Promise<void> | void;
  finishRejectedMove(result: RejectedLevelMoveResult): Promise<void> | void;
  cancelActiveVisuals(): void;
  clearTransientState(): void;
  synchronizeAuthoritativeState(): void;
  reportPlaybackError(error: unknown): void;
}

export class ResolutionPlaybackController {
  private mode: PlaybackMode = 'normal';
  private reducedMotion = false;
  private playing = false;
  private generation = 0;

  public constructor(private readonly adapter: ResolutionPlaybackAdapter) {}

  public isPlaying(): boolean {
    return this.playing;
  }

  public setMode(mode: PlaybackMode): void {
    this.mode = mode;
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
  }

  public getSettings(): PlaybackSettings {
    return {
      mode: this.mode,
      reducedMotion: this.reducedMotion,
    };
  }

  public cancel(options?: { restoreInput?: boolean }): void {
    const restoreInput = options?.restoreInput ?? true;

    this.generation += 1;
    this.playing = false;
    this.adapter.cancelActiveVisuals();
    this.adapter.clearTransientState();

    if (restoreInput) {
      this.adapter.synchronizeAuthoritativeState();
      this.adapter.applyInputLock(this.adapter.isAuthoritativeTerminal());
    }
  }

  public async playAcceptedMove(result: AcceptedLevelMoveResult): Promise<PlaybackCompletion> {
    if (this.playing) {
      return {
        completed: false,
        cancelled: true,
        reason: 'busy',
      };
    }

    const runId = this.startRun();
    const settings = this.getSettings();
    const objectiveDefinitions =
      'getObjectiveDefinitions' in this.adapter &&
      typeof this.adapter.getObjectiveDefinitions === 'function'
        ? this.adapter.getObjectiveDefinitions()
        : [];
    const plan = buildMovePlaybackPlan(result, objectiveDefinitions);

    this.adapter.prepareAcceptedMove(result);

    try {
      for (const command of plan.commands) {
        if (!this.isCurrentRun(runId)) {
          return this.cancelledCompletion();
        }

        await this.adapter.executeCommand(command, settings);
      }

      if (!this.isCurrentRun(runId)) {
        return this.cancelledCompletion();
      }

      await this.adapter.finishAcceptedMove(result, plan.summary);

      if (!this.isCurrentRun(runId)) {
        return this.cancelledCompletion();
      }

      this.finishRun(result.nextState.status !== 'active');
      return {
        completed: true,
        cancelled: false,
        reason: 'completed',
      };
    } catch (error) {
      if (this.isCurrentRun(runId)) {
        this.failRun(error);
      }

      return {
        completed: false,
        cancelled: false,
        reason: 'failed',
      };
    }
  }

  public async playRejectedMove(result: RejectedLevelMoveResult): Promise<PlaybackCompletion> {
    if (this.playing) {
      return {
        completed: false,
        cancelled: true,
        reason: 'busy',
      };
    }

    const runId = this.startRun();
    const settings = this.getSettings();

    this.adapter.prepareRejectedMove(result);

    try {
      await this.adapter.playRejectedSwap(result, settings);

      if (!this.isCurrentRun(runId)) {
        return this.cancelledCompletion();
      }

      await this.adapter.finishRejectedMove(result);

      if (!this.isCurrentRun(runId)) {
        return this.cancelledCompletion();
      }

      this.finishRun(false);
      return {
        completed: true,
        cancelled: false,
        reason: 'completed',
      };
    } catch (error) {
      if (this.isCurrentRun(runId)) {
        this.failRun(error);
      }

      return {
        completed: false,
        cancelled: false,
        reason: 'failed',
      };
    }
  }

  private startRun(): number {
    this.generation += 1;
    this.playing = true;
    this.adapter.applyInputLock(true);
    return this.generation;
  }

  private finishRun(keepLocked: boolean): void {
    this.playing = false;
    this.adapter.applyInputLock(keepLocked);
  }

  private failRun(error: unknown): void {
    this.playing = false;
    this.adapter.cancelActiveVisuals();
    this.adapter.clearTransientState();
    this.adapter.synchronizeAuthoritativeState();
    this.adapter.reportPlaybackError(error);
    this.adapter.applyInputLock(this.adapter.isAuthoritativeTerminal());
  }

  private cancelledCompletion(): PlaybackCompletion {
    return {
      completed: false,
      cancelled: true,
      reason: 'cancelled',
    };
  }

  private isCurrentRun(runId: number): boolean {
    return this.generation === runId;
  }
}
