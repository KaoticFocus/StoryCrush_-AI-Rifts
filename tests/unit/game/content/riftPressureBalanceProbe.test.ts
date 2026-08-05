import { describe, expect, it } from 'vitest';
import {
  createGeneratedLevelSession,
  getPlayableLevelContent,
} from '../../../../src/game/content/levelCatalog';
import { findPlayableSwaps } from '../../../../src/game/board';
import {
  evaluateHardGates,
  getEffectiveThreatDeadline,
  RIFT_PRESSURE_PROBE_SEEDS,
  runRiftPressureProbeForSeed,
  summarizeRiftPressureProbe,
} from './riftPressureBalanceProbe';

/** Representative subset used for repeated determinism checks. */
const FIXED_SUBSET = [1831, 1835, 1840, 1845, 1850, 1855, 1860, 1865, 1870] as const;

describe('rift pressure balance probe', () => {
  it('covers forty seeds and preserves thornwake identity', () => {
    expect(RIFT_PRESSURE_PROBE_SEEDS).toHaveLength(40);
    expect(RIFT_PRESSURE_PROBE_SEEDS[0]).toBe(1831);
    expect(RIFT_PRESSURE_PROBE_SEEDS[39]).toBe(1870);
    const content = getPlayableLevelContent('thornwake-containment')!;
    expect(getEffectiveThreatDeadline(content)).toBe(15);
    expect(content.definition.threat?.sourceCells).toEqual([{ row: 7, column: 3 }]);
  });

  it('keeps all forty seeds initially valid and playable', () => {
    const content = getPlayableLevelContent('thornwake-containment')!;
    for (const seed of RIFT_PRESSURE_PROBE_SEEDS) {
      const session = createGeneratedLevelSession({ content, seed });
      const threat = session.state.threatState;
      expect(session.state.status).toBe('active');
      expect(threat?.corruptedCells).toEqual([{ row: 7, column: 3 }]);
      expect(threat?.threatenedCell).not.toBeNull();
      const playable = findPlayableSwaps(session.state.board, threat?.corruptedCells ?? []);
      expect(playable.length).toBeGreaterThan(0);
    }
  });

  it('keeps the selected threat-aware baseline deterministic for the shared seed matrix', () => {
    const runs = RIFT_PRESSURE_PROBE_SEEDS.map((seed) =>
      runRiftPressureProbeForSeed({ seed, policy: 'threat-aware' }),
    );
    const again = RIFT_PRESSURE_PROBE_SEEDS.map((seed) =>
      runRiftPressureProbeForSeed({ seed, policy: 'threat-aware' }),
    );
    expect(again).toEqual(runs);

    const summary = summarizeRiftPressureProbe('threat-aware', runs);
    expect(evaluateHardGates(summary)).toBe(true);
    // Locked RH-3 selected-candidate evidence (seeds 1831–1870).
    expect(summary).toMatchObject({
      seedCount: 40,
      wins: 23,
      failures: 17,
      unfinished: 0,
      winRate: 0.575,
      threatFailures: 17,
      moveLimitFailures: 0,
      medianScore: 3025,
      medianMovesUsed: 14.5,
      medianHunger: 4,
      medianSpreads: 4,
      medianCleanses: 3,
      specialOriginCleanseRate: 0.275,
      nearOverwhelmWins: 9,
      invalidRejectedSelections: 0,
      returnedActiveWithoutPlayable: 0,
    });
  }, 90_000);

  it('keeps a fixed seed subset identical across repeated threat-aware runs', () => {
    const baselines = FIXED_SUBSET.map((seed) =>
      runRiftPressureProbeForSeed({ seed, policy: 'threat-aware' }),
    );
    const again = FIXED_SUBSET.map((seed) =>
      runRiftPressureProbeForSeed({ seed, policy: 'threat-aware' }),
    );
    expect(again).toEqual(baselines);
    expect(summarizeRiftPressureProbe('threat-aware', baselines).unfinished).toBe(0);
  }, 45_000);
});
