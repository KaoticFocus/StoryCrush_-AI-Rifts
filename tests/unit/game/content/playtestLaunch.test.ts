import { describe, expect, it } from 'vitest';
import {
  formatPlaytestSeedLabel,
  parsePlaytestLaunch,
} from '../../../../src/game/content/playtestLaunch';

describe('parsePlaytestLaunch', () => {
  it('returns a descriptor for valid playtest URLs', () => {
    expect(parsePlaytestLaunch('?playtest=1&level=rift-erosion-lab&seed=1812')).toEqual({
      levelId: 'rift-erosion-lab',
      seed: 1812,
    });
    expect(parsePlaytestLaunch('playtest=1&level=archive-stabilization&seed=0')).toEqual({
      levelId: 'archive-stabilization',
      seed: 0,
    });
    expect(parsePlaytestLaunch('?playtest=1&level=thornwake-containment&seed=1831')).toEqual({
      levelId: 'thornwake-containment',
      seed: 1831,
    });
  });

  it('ignores ordinary URLs without the playtest contract', () => {
    expect(parsePlaytestLaunch('')).toBeNull();
    expect(parsePlaytestLaunch('?level=archive-stabilization&seed=1807')).toBeNull();
    expect(parsePlaytestLaunch('?playtest=0&level=archive-stabilization&seed=1807')).toBeNull();
    expect(parsePlaytestLaunch('?playtest=1&level=archive-stabilization')).toBeNull();
    expect(parsePlaytestLaunch('?playtest=1&seed=1807')).toBeNull();
    expect(
      parsePlaytestLaunch(
        '?playtest=1&level=archive-stabilization&level=moonwell-recovery&seed=1807',
      ),
    ).toBeNull();
    expect(
      parsePlaytestLaunch('?playtest=1&level=archive-stabilization&seed=1807&seed=1808'),
    ).toBeNull();
  });

  it('rejects malformed or unknown playtest URLs', () => {
    expect(parsePlaytestLaunch('?playtest=1&level=missing-level&seed=1807')).toBeNull();
    expect(parsePlaytestLaunch('?playtest=1&level=archive-stabilization&seed=abc')).toBeNull();
    expect(parsePlaytestLaunch('?playtest=1&level=archive-stabilization&seed=')).toBeNull();
    expect(parsePlaytestLaunch('?playtest=1&level=archive-stabilization&seed=-1')).toBeNull();
    expect(parsePlaytestLaunch('?playtest=1&level=archive-stabilization&seed=1.5')).toBeNull();
    expect(
      parsePlaytestLaunch(`?playtest=1&level=archive-stabilization&seed=${'9'.repeat(17)}`),
    ).toBeNull();
  });
});

describe('formatPlaytestSeedLabel', () => {
  it('formats the phone-readable seed label', () => {
    expect(formatPlaytestSeedLabel(1812)).toBe('Playtest seed 1812');
  });
});
