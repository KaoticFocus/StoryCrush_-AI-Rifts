import { describe, expect, it } from 'vitest';
import {
  createPrototypeLevelSession,
  prototypeLevelDefinition,
} from '../../../src/game/content/prototypeLevel';
import {
  createLevelViewModel,
  formatMoveSummary,
  formatObjectiveLabel,
  getLevelStatusLabel,
} from '../../../src/game/presentation/levelViewModel';
import { PuzzleSessionController } from '../../../src/game/presentation/PuzzleSessionController';

describe('levelViewModel', () => {
  it('formats objective labels and player-facing status text', () => {
    expect(formatObjectiveLabel(prototypeLevelDefinition.objectives[0], 120)).toBe(
      'Score: 120 / 600',
    );
    expect(formatObjectiveLabel(prototypeLevelDefinition.objectives[1], 4)).toBe(
      'Collect Ruby: 4 / 10',
    );
    expect(getLevelStatusLabel('active')).toBe('Active');
    expect(getLevelStatusLabel('won')).toBe('Level Complete');
    expect(getLevelStatusLabel('failed')).toBe('Out of Moves');
  });

  it('formats accepted and rejected move summaries from domain results', () => {
    const controller = new PuzzleSessionController(
      prototypeLevelDefinition,
      () => createPrototypeLevelSession().state,
    );

    const accepted = controller.requestSwap({ row: 4, column: 4 }, { row: 4, column: 5 });
    const rejected = controller.requestSwap({ row: 0, column: 0 }, { row: 0, column: 1 });

    expect(formatMoveSummary(accepted)).toMatch(/^\+\d+ points · \d+ cascades? · /);
    expect(formatMoveSummary(rejected)).toBe(
      'Rejected move. That swap does not create a playable result.',
    );
  });

  it('creates HUD-friendly state text without mutating session state', () => {
    const session = createPrototypeLevelSession().state;
    const viewModel = createLevelViewModel(prototypeLevelDefinition, session);

    expect(viewModel.scoreText).toBe('Score 0');
    expect(viewModel.movesText).toBe('Moves 15');
    expect(viewModel.objectives).toHaveLength(2);

    viewModel.objectives[0].label = 'mutated';
    const second = createLevelViewModel(prototypeLevelDefinition, session);
    expect(second.objectives[0].label).toBe('Score: 0 / 600');
  });
});
