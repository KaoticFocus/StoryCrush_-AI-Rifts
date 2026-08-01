import { describe, expect, it, vi } from 'vitest';
import {
  createGameFlowController,
  createPrototypeCampaignDefinition,
  type GameFlowState,
} from '../../../../src/game/flow/gameFlowController';
import {
  createBrowserGameFlowStorage,
  createGameFlowRepository,
  createInMemoryGameFlowStorage,
  type GameFlowStorageAdapter,
} from '../../../../src/game/flow/gameFlowRepository';
import { createGameFlowPersistenceCoordinator } from '../../../../src/game/flow/gameFlowPersistenceCoordinator';

function createStorageHarness(): {
  storage: GameFlowStorageAdapter;
  repository: ReturnType<typeof createGameFlowRepository>;
} {
  const storage = createInMemoryGameFlowStorage();
  const repository = createGameFlowRepository(storage);
  return { storage, repository };
}

describe('game flow repository', () => {
  it('persists and restores a flow state with schema versioning', () => {
    const { repository } = createStorageHarness();
    const controller = createGameFlowController(createPrototypeCampaignDefinition());

    controller.advanceTo('multiverse-map');
    controller.advanceTo('fantasy-chapter-intro');
    controller.advanceTo('fantasy-dialogue');
    controller.chooseStoryOption('fantasy-stabilize');
    controller.advanceTo('fantasy-choice');
    controller.advanceTo('puzzle');
    controller.recordPuzzleResult({ outcome: 'won', score: 1200, movesRemaining: 7 });
    controller.advanceTo('results');

    expect(repository.save(controller).ok).toBe(true);

    const restoredController = createGameFlowController(createPrototypeCampaignDefinition());
    expect(repository.restore(restoredController).ok).toBe(true);

    const state = restoredController.getState();
    expect(state.currentNodeId).toBe('results');
    expect(state.storyFlags).toEqual(['FANTASY_ARCHIVE_STABILIZED']);
    expect(state.latestPuzzleResult?.outcome).toBe('won');
    expect(state.hasContinuableSession).toBe(true);
  });

  it('migrates a legacy schema version 1 payload when browser storage is used', () => {
    const storage = createBrowserGameFlowStorage();
    const repository = createGameFlowRepository(storage);
    storage.setItem(
      'storycrush.game-flow',
      JSON.stringify({
        schemaVersion: 1,
        state: {
          currentNodeId: 'results',
          storyFlags: ['FANTASY_ARCHIVE_STABILIZED'],
          chapterStatus: {},
          latestPuzzleResult: { outcome: 'won', score: 1200, movesRemaining: 7 },
        },
      }),
    );

    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const result = repository.restore(controller);

    expect(result.ok).toBe(true);
    expect(result.status).toBe('restored');
    expect(controller.getState().currentNodeId).toBe('results');
    expect(controller.getState().hasContinuableSession).toBe(true);
  });

  it('auto-saves updates through a persistence coordinator', () => {
    const storage = createBrowserGameFlowStorage();
    const repository = createGameFlowRepository(storage);
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const coordinator = createGameFlowPersistenceCoordinator(controller, repository);

    const initResult = coordinator.initialize();
    expect(initResult.ok).toBe(true);
    expect(initResult.status).toBe('not-found');

    controller.advanceTo('multiverse-map');

    const savedPayload = storage.getItem('storycrush.game-flow').value;
    expect(savedPayload).toBeTruthy();
    expect(savedPayload).toContain('"currentNodeId":"multiverse-map"');
  });

  it('reuses the same coordinator lifecycle for the same controller and repository', () => {
    const storage = createInMemoryGameFlowStorage();
    const repository = createGameFlowRepository(storage);
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const restoreSpy = vi.spyOn(repository, 'restore');

    const firstCoordinator = createGameFlowPersistenceCoordinator(controller, repository);
    const secondCoordinator = createGameFlowPersistenceCoordinator(controller, repository);

    firstCoordinator.initialize();
    secondCoordinator.initialize();

    expect(restoreSpy).toHaveBeenCalledTimes(1);
  });

  it('clears an invalid active payload without crashing', () => {
    const { repository, storage } = createStorageHarness();
    storage.setItem('storycrush.game-flow', '{bad json');

    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const result = repository.restore(controller);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('corrupt-cleared');
    expect(controller.getState().currentNodeId).toBe('main-menu');
    expect(storage.getItem('storycrush.game-flow').value).toBeNull();
  });

  it('rejects persisted states with unsupported node identifiers', () => {
    const { repository, storage } = createStorageHarness();
    storage.setItem(
      'storycrush.game-flow',
      JSON.stringify({
        schemaVersion: 1,
        state: {
          currentNodeId: 'not-a-real-node',
          storyFlags: [],
          chapterStatus: {},
          latestPuzzleResult: null,
          hasContinuableSession: false,
        },
      }),
    );

    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const result = repository.restore(controller);

    expect(result.ok).toBe(false);
    expect(result.status).toBe('corrupt-cleared');
    expect(controller.getState().currentNodeId).toBe('main-menu');
    expect(storage.getItem('storycrush.game-flow').value).toBeNull();
  });

  it('writes schema version 2 and preserves the migrated state payload', () => {
    const storage = createInMemoryGameFlowStorage();
    const repository = createGameFlowRepository(storage, { now: () => 1700 });
    const controller = createGameFlowController(createPrototypeCampaignDefinition());

    controller.advanceTo('multiverse-map');
    controller.advanceTo('fantasy-chapter-intro');
    controller.advanceTo('fantasy-dialogue');
    controller.chooseStoryOption('fantasy-stabilize');
    controller.advanceTo('fantasy-choice');
    controller.advanceTo('puzzle');
    controller.recordPuzzleResult({ outcome: 'won', score: 1200, movesRemaining: 7 });
    controller.advanceTo('results');

    const saveResult = repository.save(controller);
    expect(saveResult.ok).toBe(true);

    const payload = storage.getItem('storycrush.game-flow').value;
    expect(payload).toContain('"schemaVersion":2');
    expect(payload).toContain('"savedAtEpochMs":1700');
    expect(payload).toContain('"FANTASY_ARCHIVE_STABILIZED"');
  });

  it('replaces an existing campaign save and persists the new map state', () => {
    const storage = createInMemoryGameFlowStorage();
    const repository = createGameFlowRepository(storage);
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const coordinator = createGameFlowPersistenceCoordinator(controller, repository);

    controller.advanceTo('multiverse-map');
    controller.advanceTo('fantasy-chapter-intro');
    controller.advanceTo('fantasy-dialogue');
    controller.chooseStoryOption('fantasy-stabilize');
    controller.advanceTo('fantasy-choice');
    controller.advanceTo('puzzle');
    controller.recordPuzzleResult({ outcome: 'won', score: 1200, movesRemaining: 7 });
    controller.advanceTo('results');
    repository.save(controller);

    coordinator.replaceWithNewCampaign(() => {
      controller.resetProgress();
      controller.advanceTo('multiverse-map');
    });

    const persistedPayload = storage.getItem('storycrush.game-flow').value;
    expect(persistedPayload).toContain('"currentNodeId":"multiverse-map"');
    expect(persistedPayload).not.toContain('FANTASY_ARCHIVE_STABILIZED');
    expect(persistedPayload).not.toContain('"latestPuzzleResult"');

    const restoredController = createGameFlowController(createPrototypeCampaignDefinition());
    expect(repository.restore(restoredController).ok).toBe(true);
    expect(restoredController.getState().currentNodeId).toBe('multiverse-map');
    expect(restoredController.getState().storyFlags).toEqual([]);
    expect(restoredController.getState().latestPuzzleResult).toBeNull();
  });

  it('starts a new in-memory campaign when durable replacement is unavailable', () => {
    const setItem = vi.fn(() => ({
      ok: false,
      mode: 'unavailable' as const,
      error: 'security' as const,
    }));
    const removeItem = vi.fn(() => ({
      ok: false,
      mode: 'unavailable' as const,
      error: 'security' as const,
    }));
    const unavailableStorage: GameFlowStorageAdapter = {
      mode: 'unavailable',
      getItem: () => ({ ok: false, value: null, mode: 'unavailable', error: 'security' }),
      setItem,
      removeItem,
    };
    const repository = createGameFlowRepository(unavailableStorage);
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const coordinator = createGameFlowPersistenceCoordinator(controller, repository);

    controller.advanceTo('multiverse-map');
    controller.advanceTo('fantasy-chapter-intro');
    controller.advanceTo('fantasy-dialogue');
    controller.chooseStoryOption('fantasy-stabilize');

    const replacement = coordinator.replaceWithNewCampaign(() => {
      controller.resetProgress();
      controller.advanceTo('multiverse-map');
    });

    expect(replacement).toMatchObject({ ok: false, status: 'storage-unavailable' });
    expect(removeItem).toHaveBeenCalledOnce();
    expect(setItem).toHaveBeenCalledOnce();
    expect(controller.getState()).toMatchObject({
      currentNodeId: 'multiverse-map',
      storyFlags: [],
      latestPuzzleResult: null,
    });
  });

  it('replaces an unsupported future save only after explicit confirmation', () => {
    const storage = createInMemoryGameFlowStorage();
    const futurePayload = JSON.stringify({
      schemaVersion: 999,
      state: { currentNodeId: 'main-menu' },
    });
    storage.setItem('storycrush.game-flow', futurePayload);
    const repository = createGameFlowRepository(storage);
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const coordinator = createGameFlowPersistenceCoordinator(controller, repository);

    coordinator.initialize();
    expect(storage.getItem('storycrush.game-flow').value).toBe(futurePayload);
    expect(coordinator.getSessionStatus()).toMatchObject({
      savePresent: true,
      canContinue: false,
      warning: 'future-version',
    });

    const replacement = coordinator.replaceWithNewCampaign(() => {
      controller.resetProgress();
      controller.advanceTo('multiverse-map');
    });

    expect(replacement.status).toBe('saved');
    expect(storage.getItem('storycrush.game-flow').value).toContain('"schemaVersion":2');
    expect(storage.getItem('storycrush.game-flow').value).toContain(
      '"currentNodeId":"multiverse-map"',
    );
  });

  it('derives an authoritative continue status for restored, corrupt, and unsupported saves', () => {
    const emptyStorage = createInMemoryGameFlowStorage();
    const emptyRepository = createGameFlowRepository(emptyStorage);
    const emptyController = createGameFlowController(createPrototypeCampaignDefinition());
    const emptyCoordinator = createGameFlowPersistenceCoordinator(emptyController, emptyRepository);
    emptyCoordinator.initialize();
    expect(emptyCoordinator.getSessionStatus()).toMatchObject({
      mode: 'memory-only',
      savePresent: false,
      canContinue: false,
      resolvedNodeId: null,
    });

    const validStorage = createInMemoryGameFlowStorage();
    validStorage.setItem(
      'storycrush.game-flow',
      JSON.stringify({
        schemaVersion: 2,
        savedAtEpochMs: 1,
        state: {
          currentNodeId: 'results',
          storyFlags: ['FANTASY_ARCHIVE_STABILIZED'],
          chapterStatus: {},
          latestPuzzleResult: { outcome: 'won', score: 1200, movesRemaining: 7 },
          hasContinuableSession: true,
        },
      }),
    );
    const validRepository = createGameFlowRepository(validStorage);
    const validController = createGameFlowController(createPrototypeCampaignDefinition());
    const validCoordinator = createGameFlowPersistenceCoordinator(validController, validRepository);
    validCoordinator.initialize();
    const continueStatus = validCoordinator.getSessionStatus();
    expect(continueStatus.savePresent).toBe(true);
    expect(continueStatus.canContinue).toBe(true);
    expect(continueStatus.resolvedNodeId).toBe('results');

    const corruptStorage = createInMemoryGameFlowStorage();
    corruptStorage.setItem('storycrush.game-flow', '{bad json');
    const corruptRepository = createGameFlowRepository(corruptStorage);
    const corruptController = createGameFlowController(createPrototypeCampaignDefinition());
    const corruptCoordinator = createGameFlowPersistenceCoordinator(
      corruptController,
      corruptRepository,
    );
    corruptCoordinator.initialize();
    const corruptStatus = corruptCoordinator.getSessionStatus();
    expect(corruptStatus.savePresent).toBe(false);
    expect(corruptStatus.canContinue).toBe(false);
    expect(corruptStatus.warning).toBe('corrupt-reset');

    const futureStorage = createInMemoryGameFlowStorage();
    futureStorage.setItem(
      'storycrush.game-flow',
      JSON.stringify({ schemaVersion: 999, state: { currentNodeId: 'main-menu' } }),
    );
    const futureRepository = createGameFlowRepository(futureStorage);
    const futureController = createGameFlowController(createPrototypeCampaignDefinition());
    const futureCoordinator = createGameFlowPersistenceCoordinator(
      futureController,
      futureRepository,
    );
    futureCoordinator.initialize();
    const futureStatus = futureCoordinator.getSessionStatus();
    expect(futureStatus.savePresent).toBe(true);
    expect(futureStatus.canContinue).toBe(false);
    expect(futureStatus.warning).toBe('future-version');
  });

  it('restores only once and projects session status from the cached result', () => {
    const storage = createInMemoryGameFlowStorage();
    const repository = createGameFlowRepository(storage);
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const restoreSpy = vi.spyOn(repository, 'restore');
    const coordinator = createGameFlowPersistenceCoordinator(controller, repository);

    coordinator.initialize();
    coordinator.getSessionStatus();
    coordinator.getSessionStatus();

    expect(restoreSpy).toHaveBeenCalledTimes(1);
  });

  it('returns a storage-unavailable result when browser storage writes fail', () => {
    const storage = createBrowserGameFlowStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => true,
    });
    const repository = createGameFlowRepository(storage);
    const controller = createGameFlowController(createPrototypeCampaignDefinition());

    const result = repository.save(controller);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('storage-unavailable');
  });

  it('reports adapter read failures without crashing', () => {
    const storage = createBrowserGameFlowStorage({
      getItem: () => {
        throw new Error('SecurityError: access denied');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    });

    const readResult = storage.getItem('storycrush.game-flow');
    expect(readResult.ok).toBe(false);
    expect(readResult.mode).toBe('unavailable');
    expect(readResult.error).toBe('security');
  });

  it('rejects payloads with conflicting story flags and numeric strings', () => {
    const { repository, storage } = createStorageHarness();
    const invalidState: GameFlowState = {
      currentNodeId: 'results',
      storyFlags: ['FANTASY_ARCHIVE_STABILIZED', 'FANTASY_FRACTURE_EXPLOITED'],
      chapterStatus: {},
      latestPuzzleResult: {
        outcome: 'won',
        score: '1200' as unknown as number,
        movesRemaining: 7,
      },
      hasContinuableSession: true,
    };
    storage.setItem(
      'storycrush.game-flow',
      JSON.stringify({ schemaVersion: 2, savedAtEpochMs: 1, state: invalidState }),
    );

    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const result = repository.restore(controller);

    expect(result.ok).toBe(false);
    expect(result.status).toBe('corrupt-cleared');
    expect(storage.getItem('storycrush.game-flow').value).toBeNull();
  });
});
