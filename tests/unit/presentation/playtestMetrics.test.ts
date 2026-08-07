import { describe, expect, it } from 'vitest';
import { findPlayableSwaps } from '../../../src/game/board';
import {
  createGeneratedLevelSession,
  getPlayableLevelContent,
} from '../../../src/game/content/levelCatalog';
import { applyLevelMove } from '../../../src/game/level';
import { createPlaytestMetricsAccumulator } from '../../../src/game/presentation/playtestMetrics';

describe('playtestMetrics', () => {
  const levelContent = getPlayableLevelContent('rift-erosion-lab');
  if (!levelContent) {
    throw new Error('Expected rift-erosion-lab in catalog');
  }
  const content = levelContent;

  function createAcceptedMove(seed: number) {
    const definition = { ...content.definition, seed };
    const session = createGeneratedLevelSession({ content, seed });
    const swap = findPlayableSwaps(
      session.state.board,
      session.state.threatState?.corruptedCells,
    )[0];
    if (!swap) {
      throw new Error(`Expected playable swap for seed ${seed}`);
    }
    const result = applyLevelMove({
      definition,
      state: session.state,
      from: swap.from,
      to: swap.to,
    });
    if (!result.accepted) {
      throw new Error('Expected accepted move for playtest metrics probe');
    }
    return result;
  }

  it('resets to an empty active snapshot for a fixed seed', () => {
    const metrics = createPlaytestMetricsAccumulator();
    metrics.reset({
      levelId: 'rift-erosion-lab',
      seed: 1812,
      moveLimit: levelContent.definition.moveLimit,
      hungerMaximum: levelContent.definition.threat?.hungerMaximum ?? 0,
    });

    expect(metrics.getSnapshot()).toEqual({
      levelId: 'rift-erosion-lab',
      seed: 1812,
      outcome: 'active',
      finalScore: 0,
      movesUsed: 0,
      movesRemaining: levelContent.definition.moveLimit,
      maximumHungerReached: 0,
      finalHunger: 0,
      spreads: 0,
      uniqueCleanses: 0,
      adjacentCleanses: 0,
      lineCleanses: 0,
      crossCleanses: 0,
      wildcardCleanses: 0,
      specialActivations: 0,
      cascades: 0,
      reshuffles: 0,
      nearOverwhelmReached: false,
    });
  });

  it('records accepted moves deterministically and formats a plain-text summary', () => {
    const metrics = createPlaytestMetricsAccumulator();
    metrics.reset({
      levelId: 'rift-erosion-lab',
      seed: 1812,
      moveLimit: levelContent.definition.moveLimit,
      hungerMaximum: levelContent.definition.threat?.hungerMaximum ?? 0,
    });

    const firstMove = createAcceptedMove(1812);
    metrics.recordAccepted(firstMove);
    const afterFirst = metrics.cloneSnapshot();

    metrics.reset({
      levelId: 'rift-erosion-lab',
      seed: 1812,
      moveLimit: levelContent.definition.moveLimit,
      hungerMaximum: levelContent.definition.threat?.hungerMaximum ?? 0,
    });
    metrics.recordAccepted(firstMove);
    expect(metrics.cloneSnapshot()).toEqual(afterFirst);

    const summary = metrics.formatPlainTextSummary();
    expect(summary).toContain('RH-3 Playtest Summary');
    expect(summary).toContain('Level: rift-erosion-lab');
    expect(summary).toContain('Seed: 1812');
    expect(summary).toContain(`Moves used: ${afterFirst.movesUsed}`);
    expect(summary).toContain(`Score: ${afterFirst.finalScore}`);
  });

  it('restart reset clears prior move history for the same seed', () => {
    const metrics = createPlaytestMetricsAccumulator();
    metrics.reset({
      levelId: 'rift-erosion-lab',
      seed: 1812,
      moveLimit: levelContent.definition.moveLimit,
      hungerMaximum: levelContent.definition.threat?.hungerMaximum ?? 0,
    });
    metrics.recordAccepted(createAcceptedMove(1812));

    metrics.reset({
      levelId: 'rift-erosion-lab',
      seed: 1812,
      moveLimit: levelContent.definition.moveLimit,
      hungerMaximum: levelContent.definition.threat?.hungerMaximum ?? 0,
    });

    expect(metrics.getSnapshot().movesUsed).toBe(0);
    expect(metrics.getSnapshot().finalScore).toBe(0);
    expect(metrics.getSnapshot().outcome).toBe('active');
  });
});
