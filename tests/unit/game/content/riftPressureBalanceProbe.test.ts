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
  type RiftPressureProbePolicy,
  type RiftPressureProbeRun,
} from './riftPressureBalanceProbe';

const FIXED_SUBSET = [1831, 1835, 1840, 1845, 1850, 1855, 1860, 1865, 1870] as const;

async function yieldEventLoop(): Promise<void> {
  // Prefer a portable awaitable yield over timer globals (eslint no-undef in CI).
  await Promise.resolve();
}

async function runPolicyMatrix(policy: RiftPressureProbePolicy): Promise<RiftPressureProbeRun[]> {
  const runs: RiftPressureProbeRun[] = [];
  for (let index = 0; index < RIFT_PRESSURE_PROBE_SEEDS.length; index += 1) {
    runs.push(
      runRiftPressureProbeForSeed({
        seed: RIFT_PRESSURE_PROBE_SEEDS[index]!,
        policy,
      }),
    );
    if (index % 4 === 3) {
      await yieldEventLoop();
    }
  }
  return runs;
}

describe('rift pressure balance probe', () => {
  it('covers forty seeds and preserves thornwake identity', () => {
    expect(RIFT_PRESSURE_PROBE_SEEDS).toHaveLength(40);
    expect(RIFT_PRESSURE_PROBE_SEEDS[0]).toBe(1831);
    expect(RIFT_PRESSURE_PROBE_SEEDS[39]).toBe(1870);
    const content = getPlayableLevelContent('thornwake-containment')!;
    expect(getEffectiveThreatDeadline(content)).toBe(15);
    expect(content.definition.threat?.sourceCells).toEqual([{ row: 7, column: 3 }]);
  });

  it('keeps all forty seeds initially valid and playable', async () => {
    const content = getPlayableLevelContent('thornwake-containment')!;
    for (let index = 0; index < RIFT_PRESSURE_PROBE_SEEDS.length; index += 1) {
      const seed = RIFT_PRESSURE_PROBE_SEEDS[index]!;
      const session = createGeneratedLevelSession({ content, seed });
      const threat = session.state.threatState;
      expect(session.state.status).toBe('active');
      expect(threat?.corruptedCells).toEqual([{ row: 7, column: 3 }]);
      expect(threat?.threatenedCell).not.toBeNull();
      const playable = findPlayableSwaps(session.state.board, threat?.corruptedCells ?? []);
      expect(playable.length).toBeGreaterThan(0);
      if (index % 8 === 7) await yieldEventLoop();
    }
  });

  it('passes hard gates for first-playable policy', async () => {
    const summary = summarizeRiftPressureProbe(
      'first-playable',
      await runPolicyMatrix('first-playable'),
    );
    expect(evaluateHardGates(summary)).toBe(true);
    expect(summary.wins).toBe(0);
  }, 60_000);

  it('passes hard gates for objective-first policy', async () => {
    const summary = summarizeRiftPressureProbe(
      'objective-first',
      await runPolicyMatrix('objective-first'),
    );
    expect(evaluateHardGates(summary)).toBe(true);
  }, 60_000);

  it('meets soft targets for threat-aware policy', async () => {
    const summary = summarizeRiftPressureProbe(
      'threat-aware',
      await runPolicyMatrix('threat-aware'),
    );
    expect(evaluateHardGates(summary)).toBe(true);
    expect(summary.winRate).toBeGreaterThanOrEqual(0.45);
    expect(summary.winRate).toBeLessThanOrEqual(0.75);
    expect(summary.winRate).toBeGreaterThanOrEqual(0.15);
    expect(summary.nearOverwhelmWins).toBeGreaterThanOrEqual(2);
    expect(summary.specialOriginCleanseRate).toBeGreaterThanOrEqual(0.25);
    expect(summary.threatFailures / summary.seedCount).toBeGreaterThanOrEqual(0.15);
    expect(summary.threatFailures / summary.seedCount).toBeLessThanOrEqual(0.55);
  }, 60_000);

  it('keeps a fixed seed subset identical across repeated threat-aware runs', async () => {
    const baselines = [];
    for (const seed of FIXED_SUBSET) {
      baselines.push(runRiftPressureProbeForSeed({ seed, policy: 'threat-aware' }));
      await yieldEventLoop();
    }
    for (let i = 0; i < 3; i += 1) {
      const again = [];
      for (const seed of FIXED_SUBSET) {
        again.push(runRiftPressureProbeForSeed({ seed, policy: 'threat-aware' }));
        await yieldEventLoop();
      }
      expect(again).toEqual(baselines);
    }
    expect(summarizeRiftPressureProbe('threat-aware', baselines).unfinished).toBe(0);
  }, 90_000);
});
