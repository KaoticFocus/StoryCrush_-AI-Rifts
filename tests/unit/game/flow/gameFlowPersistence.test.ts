import { describe, expect, it } from 'vitest';
import {
  createGameFlowController,
  createPrototypeCampaignDefinition,
} from '../../../../src/game/flow/gameFlowController';
import {
  createGameFlowRepository,
  createInMemoryGameFlowStorage,
  type GameFlowStorageAdapter,
} from '../../../../src/game/flow/gameFlowRepository';

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

    expect(repository.save(controller)).toBe(true);

    const restoredController = createGameFlowController(createPrototypeCampaignDefinition());
    expect(repository.restore(restoredController)).toBe(true);

    const state = restoredController.getState();
    expect(state.currentNodeId).toBe('results');
    expect(state.storyFlags).toEqual(['FANTASY_ARCHIVE_STABILIZED']);
    expect(state.latestPuzzleResult?.outcome).toBe('won');
    expect(state.hasContinuableSession).toBe(true);
  });

  it('rejects invalid persisted payloads without crashing', () => {
    const { repository, storage } = createStorageHarness();
    storage.setItem('storycrush.game-flow', '{bad json');

    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    expect(repository.restore(controller)).toBe(false);
    expect(controller.getState().currentNodeId).toBe('main-menu');
  });
});
