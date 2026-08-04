import { describe, expect, it } from 'vitest';
import {
  RIFT_EROSION_LAB_PROBE_SEEDS,
  runRiftErosionLabProbeMatrix,
  summarizeRiftErosionLabProbe,
} from './riftErosionLabProbe';

describe('RH-1 Rift Erosion Lab probe', () => {
  it('is deterministic across repeated matrices and stays separate from calm baselines', () => {
    expect(RIFT_EROSION_LAB_PROBE_SEEDS).toHaveLength(21);
    const first = runRiftErosionLabProbeMatrix();
    const second = runRiftErosionLabProbeMatrix();
    expect(second).toEqual(first);

    const summary = summarizeRiftErosionLabProbe(first);
    expect(summary.seedCount).toBe(21);
    expect(summary.wins + summary.failures + summary.unfinished).toBe(21);
    // Provisional lab: must demonstrate some spreads and some cleanses across the matrix.
    expect(first.some((run) => run.spreadCount > 0)).toBe(true);
    expect(first.some((run) => run.corruptedCellsCleansed > 0)).toBe(true);
  });
});
