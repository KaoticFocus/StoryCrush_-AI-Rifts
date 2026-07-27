import { describe, expect, it } from 'vitest';
import { resolveCascade, validatePlayableSwap, type Board } from '../../../src/game/board';
import {
  type AcceptedLevelMoveResult,
  DEFAULT_SCORING_RULES,
  calculateResolutionScore,
  type LevelDefinition,
  type LevelSessionState,
} from '../../../src/game/level';
import { type RejectedLevelMoveResult } from '../../../src/game/level/levelTypes';
import {
  ResolutionPlaybackController,
  type PlaybackSettings,
  type ResolutionPlaybackAdapter,
} from '../../../src/game/presentation/playback/ResolutionPlaybackController';
import { standardBoard } from '../board/boardTestHelpers';

class ScriptedRandom {
  private index = 0;

  public constructor(private readonly values: number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index] ?? 0;
    this.index += 1;
    return value % maxExclusive;
  }
}

function createDefinition(overrides?: Partial<LevelDefinition>): LevelDefinition {
  return {
    id: 'playback-controller-level',
    moveLimit: 5,
    allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
    objectives: [{ id: 'score-main', kind: 'score', targetScore: 1000 }],
    scoring: DEFAULT_SCORING_RULES,
    seed: 12,
    ...(overrides ?? {}),
  };
}

function createState(board: Board, definition: LevelDefinition): LevelSessionState {
  return {
    levelId: definition.id,
    baseSeed: definition.seed,
    board,
    score: 0,
    movesRemaining: definition.moveLimit,
    acceptedMoveCount: 0,
    status: 'active',
    objectiveProgress: [
      {
        objectiveId: 'score-main',
        kind: 'score',
        current: 0,
        target: 1000,
        complete: false,
      },
    ],
  };
}

function createAcceptedMoveResult(): AcceptedLevelMoveResult {
  const definition = createDefinition();
  const board = standardBoard([
    ['ruby', 'sapphire', 'ruby'],
    ['topaz', 'ruby', 'emerald'],
    ['amethyst', 'pearl', 'topaz'],
  ]);
  const from = { row: 0, column: 1 };
  const to = { row: 1, column: 1 };
  const resolution = resolveCascade({
    board,
    first: from,
    second: to,
    pieceTypes: definition.allowedRefillPieceTypes,
    randomSource: new ScriptedRandom([0, 1, 2]),
  });

  expect(resolution.isValid).toBe(true);
  if (!resolution.isValid) {
    throw new Error('Expected accepted resolution');
  }

  const playableSwap = validatePlayableSwap(board, from, to);
  expect(playableSwap.isValid).toBe(true);
  if (!playableSwap.isValid || !playableSwap.kind) {
    throw new Error('Expected valid playable swap');
  }

  const previousState = createState(board, definition);
  const scoreCalculation = calculateResolutionScore({
    resolution,
    rules: DEFAULT_SCORING_RULES,
  });
  const nextState: LevelSessionState = {
    ...previousState,
    board: resolution.finalBoard,
    score: scoreCalculation.totalAwardedPoints,
    movesRemaining: previousState.movesRemaining - 1,
    acceptedMoveCount: 1,
    objectiveProgress: [
      {
        objectiveId: 'score-main',
        kind: 'score',
        current: scoreCalculation.totalAwardedPoints,
        target: 1000,
        complete: false,
      },
    ],
  };

  return {
    accepted: true,
    requestedSwap: { from, to },
    moveKind: playableSwap.kind,
    previousState,
    nextState,
    previousStatus: 'active',
    nextStatus: 'active',
    scoreBefore: 0,
    scoreAfter: scoreCalculation.totalAwardedPoints,
    movesBefore: previousState.movesRemaining,
    movesAfter: nextState.movesRemaining,
    movesConsumed: 1,
    resolutionSeed: definition.seed,
    resolution,
    scoreCalculation,
    collectionEvents: [],
    objectiveUpdates: [],
  };
}

function createRejectedMoveResult(): RejectedLevelMoveResult {
  const definition = createDefinition();
  const board = standardBoard([
    ['ruby', 'sapphire', 'emerald'],
    ['topaz', 'amethyst', 'pearl'],
    ['sapphire', 'emerald', 'topaz'],
  ]);

  return {
    accepted: false,
    kind: 'rejected',
    reason: 'no-match-created',
    requestedSwap: {
      from: { row: 0, column: 0 },
      to: { row: 0, column: 1 },
    },
    state: createState(board, definition),
    movesConsumed: 0,
  };
}

function createDeferred() {
  let resolve: (() => void) | null = null;
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve;
  });

  return {
    promise,
    resolve: () => resolve?.(),
  };
}

class FakeAdapter implements ResolutionPlaybackAdapter {
  public readonly calls: string[] = [];
  public readonly locks: boolean[] = [];
  public terminal = false;
  public deferredCommandIndex: number | null = null;
  public deferred = createDeferred();
  public shouldThrowOnCommand: string | null = null;

  public applyInputLock(locked: boolean): void {
    this.locks.push(locked);
    this.calls.push(`lock:${String(locked)}`);
  }

  public isAuthoritativeTerminal(): boolean {
    return this.terminal;
  }

  public readonly getObjectiveDefinitions = (): LevelDefinition['objectives'] =>
    createDefinition().objectives;

  public prepareAcceptedMove(): void {
    this.calls.push('prepare-accepted');
  }

  public prepareRejectedMove(): void {
    this.calls.push('prepare-rejected');
  }

  public async executeCommand(
    command: { kind: string; index: number },
    settings: PlaybackSettings,
  ) {
    this.calls.push(`command:${command.kind}:${settings.mode}:${String(settings.reducedMotion)}`);

    if (this.shouldThrowOnCommand === command.kind) {
      throw new Error(`boom:${command.kind}`);
    }

    if (this.deferredCommandIndex === command.index) {
      await this.deferred.promise;
    }
  }

  public async playRejectedSwap(_result: RejectedLevelMoveResult, settings: PlaybackSettings) {
    this.calls.push(`rejected-swap:${settings.mode}:${String(settings.reducedMotion)}`);
  }

  public finishAcceptedMove(): void {
    this.calls.push('finish-accepted');
  }

  public finishRejectedMove(): void {
    this.calls.push('finish-rejected');
  }

  public cancelActiveVisuals(): void {
    this.calls.push('cancel-visuals');
  }

  public clearTransientState(): void {
    this.calls.push('clear-transient');
  }

  public synchronizeAuthoritativeState(): void {
    this.calls.push('sync-authoritative');
  }

  public reportPlaybackError(error: unknown): void {
    this.calls.push(`error:${error instanceof Error ? error.message : 'unknown'}`);
  }
}

describe('ResolutionPlaybackController', () => {
  it('executes commands sequentially and unlocks after accepted completion', async () => {
    const adapter = new FakeAdapter();
    const controller = new ResolutionPlaybackController(adapter);

    const result = await controller.playAcceptedMove(createAcceptedMoveResult());

    expect(result).toEqual({
      completed: true,
      cancelled: false,
      reason: 'completed',
    });
    expect(adapter.calls[0]).toBe('lock:true');
    expect(adapter.calls[1]).toBe('prepare-accepted');
    expect(adapter.calls.at(-2)).toBe('finish-accepted');
    expect(adapter.calls.at(-1)).toBe('lock:false');
    expect(controller.isPlaying()).toBe(false);
  });

  it('keeps input locked during playback and cancels stale completions safely', async () => {
    const adapter = new FakeAdapter();
    adapter.deferredCommandIndex = 0;
    const controller = new ResolutionPlaybackController(adapter);

    const completionPromise = controller.playAcceptedMove(createAcceptedMoveResult());

    expect(controller.isPlaying()).toBe(true);
    expect(adapter.locks).toEqual([true]);

    controller.cancel();
    adapter.deferred.resolve();

    const result = await completionPromise;

    expect(result).toEqual({
      completed: false,
      cancelled: true,
      reason: 'cancelled',
    });
    expect(adapter.calls).toContain('sync-authoritative');
    expect(adapter.calls.at(-1)).toBe('lock:false');
  });

  it('synchronizes authoritative state and reports errors on playback failure', async () => {
    const adapter = new FakeAdapter();
    adapter.shouldThrowOnCommand = 'swap';
    const controller = new ResolutionPlaybackController(adapter);

    const result = await controller.playAcceptedMove(createAcceptedMoveResult());

    expect(result).toEqual({
      completed: false,
      cancelled: false,
      reason: 'failed',
    });
    expect(adapter.calls).toContain('cancel-visuals');
    expect(adapter.calls).toContain('clear-transient');
    expect(adapter.calls).toContain('sync-authoritative');
    expect(adapter.calls.some((entry) => entry.startsWith('error:boom:swap'))).toBe(true);
  });

  it('plays rejected swaps with the configured playback settings', async () => {
    const adapter = new FakeAdapter();
    const controller = new ResolutionPlaybackController(adapter);

    controller.setMode('fast');
    controller.setReducedMotion(true);

    const result = await controller.playRejectedMove(createRejectedMoveResult());

    expect(result).toEqual({
      completed: true,
      cancelled: false,
      reason: 'completed',
    });
    expect(adapter.calls).toContain('prepare-rejected');
    expect(adapter.calls).toContain('rejected-swap:fast:true');
    expect(adapter.calls.at(-1)).toBe('lock:false');
  });

  it('rejects concurrent playback requests safely', async () => {
    const adapter = new FakeAdapter();
    adapter.deferredCommandIndex = 0;
    const controller = new ResolutionPlaybackController(adapter);

    const firstPromise = controller.playAcceptedMove(createAcceptedMoveResult());
    const secondResult = await controller.playRejectedMove(createRejectedMoveResult());

    expect(secondResult).toEqual({
      completed: false,
      cancelled: true,
      reason: 'busy',
    });

    controller.cancel();
    adapter.deferred.resolve();
    await firstPromise;
  });
});
