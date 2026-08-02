import { describe, expect, it } from 'vitest';
import {
  BALANCE_PROBE_SEEDS,
  getCatalogContentOrThrow,
  runBalanceProbeForSeed,
  runBalanceProbeMatrix,
} from './levelBalanceProbe';
import {
  getObjectiveSummary,
  getPlayableLevelContent,
  getPlayableLevelIds,
  playableLevelCatalog,
  validatePlayableLevelCatalog,
} from '../../../../src/game/content/levelCatalog';
import { DEFAULT_SCORING_RULES } from '../../../../src/game/level';

describe('phase 3A.1 longer-level balance catalog', () => {
  it('exposes the approved first-pass score goals and unchanged collections', () => {
    expect(getPlayableLevelIds()).toEqual([
      'archive-stabilization',
      'moonwell-recovery',
      'rootbound-seal',
    ]);

    const archive = getPlayableLevelContent('archive-stabilization')!;
    const moonwell = getPlayableLevelContent('moonwell-recovery')!;
    const rootbound = getPlayableLevelContent('rootbound-seal')!;

    expect(archive.definition.moveLimit).toBe(15);
    expect(moonwell.definition.moveLimit).toBe(12);
    expect(rootbound.definition.moveLimit).toBe(10);

    expect(archive.definition.objectives).toEqual([
      { id: 'score-target', kind: 'score', targetScore: 2500 },
      { id: 'collect-ruby', kind: 'collect-piece', pieceType: 'ruby', targetCount: 10 },
    ]);
    expect(moonwell.definition.objectives).toEqual([
      { id: 'score-target', kind: 'score', targetScore: 3500 },
      { id: 'collect-sapphire', kind: 'collect-piece', pieceType: 'sapphire', targetCount: 8 },
    ]);
    expect(rootbound.definition.objectives).toEqual([
      { id: 'score-target', kind: 'score', targetScore: 5000 },
      { id: 'collect-emerald', kind: 'collect-piece', pieceType: 'emerald', targetCount: 9 },
    ]);

    expect(getObjectiveSummary(archive)).toContain('Score 2500');
    expect(getObjectiveSummary(moonwell)).toContain('Score 3500');
    expect(getObjectiveSummary(rootbound)).toContain('Score 5000');

    expect(archive.definition.seed).toBe(1807);
    expect(moonwell.definition.seed).toBe(1808);
    expect(rootbound.definition.seed).toBe(1809);
    expect(archive.allowedPieceTypes).toEqual([
      'ruby',
      'sapphire',
      'emerald',
      'topaz',
      'amethyst',
      'pearl',
    ]);
    expect(moonwell.allowedPieceTypes).toEqual([
      'sapphire',
      'emerald',
      'topaz',
      'amethyst',
      'pearl',
    ]);
    expect(rootbound.allowedPieceTypes).toEqual(['ruby', 'emerald', 'topaz', 'amethyst', 'pearl']);

    expect(archive.definition.scoring).toEqual(DEFAULT_SCORING_RULES);
    expect(validatePlayableLevelCatalog(playableLevelCatalog)).toHaveLength(3);

    const scoreTargets = [archive, moonwell, rootbound].map(
      (level) =>
        level.definition.objectives.find((objective) => objective.kind === 'score')!.targetScore,
    );
    expect(scoreTargets).toEqual([2500, 3500, 5000]);
    expect(scoreTargets[0]).toBeLessThan(scoreTargets[1]);
    expect(scoreTargets[1]).toBeLessThan(scoreTargets[2]);
    expect(archive.definition.moveLimit).toBeGreaterThan(moonwell.definition.moveLimit);
    expect(moonwell.definition.moveLimit).toBeGreaterThan(rootbound.definition.moveLimit);
  });

  it('keeps the balance probe deterministic for the shared seed matrix', () => {
    expect(BALANCE_PROBE_SEEDS).toHaveLength(21);
    expect(BALANCE_PROBE_SEEDS).toContain(1807);
    expect(BALANCE_PROBE_SEEDS).toContain(1808);
    expect(BALANCE_PROBE_SEEDS).toContain(1809);

    const first = runBalanceProbeMatrix(BALANCE_PROBE_SEEDS);
    const second = runBalanceProbeMatrix(BALANCE_PROBE_SEEDS);
    expect(second).toEqual(first);

    for (const summary of first.summaries) {
      expect(summary.wins + summary.failures + summary.unfinished).toBe(summary.seedCount);
      expect(summary.wins).toBeGreaterThan(0);
    }

    const byId = Object.fromEntries(first.summaries.map((summary) => [summary.levelId, summary]));
    // Phase 3B post-alignment aggregates (goals/seeds unchanged; special rules changed).
    expect(byId['archive-stabilization']).toMatchObject({
      wins: 18,
      failures: 3,
      unfinished: 0,
      medianScore: 2690,
      minScore: 2110,
      maxScore: 3400,
      medianMovesUsed: 9,
      medianMovesRemainingOnWin: 7,
      collectionCompleteCount: 21,
      specialsCreated: 76,
      specialsActivated: 57,
      cascadeSteps: 549,
    });
    expect(byId['moonwell-recovery']).toMatchObject({
      wins: 21,
      failures: 0,
      unfinished: 0,
      medianScore: 4260,
      minScore: 3510,
      maxScore: 9270,
      medianMovesUsed: 6,
      medianMovesRemainingOnWin: 6,
      collectionCompleteCount: 21,
      specialsCreated: 121,
      specialsActivated: 86,
      cascadeSteps: 502,
    });
    expect(byId['rootbound-seal']).toMatchObject({
      wins: 19,
      failures: 2,
      unfinished: 0,
      medianScore: 5940,
      minScore: 3910,
      maxScore: 9270,
      medianMovesUsed: 8,
      medianMovesRemainingOnWin: 3,
      collectionCompleteCount: 21,
      specialsCreated: 152,
      specialsActivated: 121,
      cascadeSteps: 611,
    });

    const archive = getCatalogContentOrThrow('archive-stabilization');
    const again = runBalanceProbeForSeed(archive, 1807);
    expect(again).toEqual(
      first.runs.find((run) => run.levelId === archive.id && run.seed === 1807),
    );
  }, 120_000);
});
