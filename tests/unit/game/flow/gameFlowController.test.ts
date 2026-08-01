import { describe, expect, it } from 'vitest';
import {
  createPrototypeCampaignDefinition,
  createInitialGameFlowState,
  createGameFlowController,
  resolveGameFlowResumeState,
  type GameFlowState,
} from '../../../../src/game/flow/gameFlowController';

describe('game flow controller', () => {
  it('starts in the main menu state', () => {
    const state = createInitialGameFlowState();
    expect(state.currentNodeId).toBe('main-menu');
    expect(state.chapterStatus).toEqual({});
  });

  it('transitions through valid nodes', () => {
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const state = controller.getState();
    expect(state.currentNodeId).toBe('main-menu');

    const advanced = controller.advanceTo('multiverse-map');
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) throw new Error('Expected transition to succeed');
    expect(advanced.state.currentNodeId).toBe('multiverse-map');
  });

  it('rejects invalid transitions', () => {
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const result = controller.advanceTo('results');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected invalid transition');
    expect(result.reason).toBe('invalid-transition');
  });

  it('records story choices and flags', () => {
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const entered = controller.advanceTo('multiverse-map');
    if (!entered.ok) throw new Error('Expected map transition to succeed');

    const chapter = controller.advanceTo('fantasy-chapter-intro');
    if (!chapter.ok) throw new Error('Expected intro transition to succeed');

    const dialogue = controller.advanceTo('fantasy-dialogue');
    if (!dialogue.ok) throw new Error('Expected dialogue transition to succeed');

    const choice = controller.chooseStoryOption('fantasy-stabilize');
    expect(choice.ok).toBe(true);
    if (!choice.ok) throw new Error('Expected choice to succeed');
    expect(choice.state.storyFlags).toContain('FANTASY_ARCHIVE_STABILIZED');
    expect(choice.state.storyFlags).not.toContain('FANTASY_FRACTURE_EXPLOITED');
  });

  it('keeps choice flags mutually exclusive', () => {
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    controller.advanceTo('multiverse-map');
    controller.advanceTo('fantasy-chapter-intro');
    controller.advanceTo('fantasy-dialogue');
    controller.chooseStoryOption('fantasy-stabilize');
    const secondChoice = controller.chooseStoryOption('fantasy-exploit');
    expect(secondChoice.ok).toBe(false);
    if (secondChoice.ok) throw new Error('Expected exclusive flag to reject');
    expect(secondChoice.reason).toBe('choice-already-committed');
  });

  it('records puzzle results and consequence selection', () => {
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    controller.advanceTo('multiverse-map');
    controller.advanceTo('fantasy-chapter-intro');
    controller.advanceTo('fantasy-dialogue');
    controller.chooseStoryOption('fantasy-stabilize');
    controller.recordPuzzleResult({ outcome: 'won', score: 1200, movesRemaining: 7 });

    const consequence = controller.getConsequenceNode();
    expect(consequence).toBe('fantasy-consequence');
  });

  it('marks chapters complete after resolution', () => {
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    controller.advanceTo('multiverse-map');
    controller.advanceTo('fantasy-chapter-intro');
    controller.advanceTo('fantasy-dialogue');
    controller.chooseStoryOption('fantasy-stabilize');
    controller.recordPuzzleResult({ outcome: 'won', score: 1200, movesRemaining: 7 });
    controller.advanceTo('fantasy-consequence');

    expect(controller.getState().chapterStatus['fantasy-chapter'].status).toBe('completed');
  });

  it('resets to a new game state', () => {
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    controller.advanceTo('multiverse-map');
    controller.advanceTo('fantasy-chapter-intro');
    controller.advanceTo('fantasy-dialogue');
    controller.chooseStoryOption('fantasy-stabilize');
    controller.resetProgress();

    const state = controller.getState();
    expect(state.currentNodeId).toBe('main-menu');
    expect(state.storyFlags).toEqual([]);
    expect(state.latestPuzzleResult).toBeNull();
  });

  it('defensively copies state for callers', () => {
    const controller = createGameFlowController(createPrototypeCampaignDefinition());
    const state = controller.getState();
    const clone = state as GameFlowState;
    clone.currentNodeId = 'puzzle';

    expect(controller.getState().currentNodeId).toBe('main-menu');
  });

  it('resolves interrupted puzzles back to a safe restart state', () => {
    const definition = createPrototypeCampaignDefinition();
    const state: GameFlowState = {
      currentNodeId: 'results',
      storyFlags: ['FANTASY_ARCHIVE_STABILIZED'],
      chapterStatus: {
        'fantasy-chapter': { status: 'in-progress' },
      },
      latestPuzzleResult: null,
      hasContinuableSession: true,
    };

    const resolved = resolveGameFlowResumeState('puzzle', state, definition);
    expect(resolved.reason).toBe('puzzle');
    expect(resolved.resolvedNodeId).toBe('puzzle');
    expect(resolved.state.currentNodeId).toBe('puzzle');
    expect(resolved.state.latestPuzzleResult).toBeNull();
    expect(resolved.state.storyFlags).toEqual(['FANTASY_ARCHIVE_STABILIZED']);
  });
});
