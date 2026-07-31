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

  it('rejects invalid persisted payloads without crashing', () => {
    const { repository, storage } = createStorageHarness();
    storage.setItem('storycrush.game-flow', '{bad json');

    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const result = repository.restore(controller);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('invalid-payload');
    expect(controller.getState().currentNodeId).toBe('main-menu');
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
    expect(result.status).toBe('invalid-payload');
    expect(controller.getState().currentNodeId).toBe('main-menu');
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
    expect(result.status).toBe('invalid-payload');
  });
});
