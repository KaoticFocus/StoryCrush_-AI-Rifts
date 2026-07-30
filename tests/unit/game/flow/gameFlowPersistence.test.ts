import { describe, expect, it } from 'vitest';
import {
  createGameFlowController,
  createPrototypeCampaignDefinition,
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

    const savedPayload = storage.getItem('storycrush.game-flow');
    expect(savedPayload).toBeTruthy();
    expect(savedPayload).toContain('"currentNodeId":"multiverse-map"');
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
});
