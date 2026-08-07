/* global URLSearchParams */
import { getPlayableLevelContent } from './levelCatalog';
import { type LevelRunDescriptor } from './levelRun';

/**
 * Narrow human-playtest URL contract.
 * Valid only when playtest=1 with a known catalog level and non-negative safe-integer seed.
 * Ordinary URLs without playtest=1 never produce a launch descriptor.
 */
export function parsePlaytestLaunch(search: string): LevelRunDescriptor | null {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (query.get('playtest') !== '1') {
    return null;
  }

  const levelValues = query.getAll('level');
  const seedValues = query.getAll('seed');
  if (levelValues.length !== 1 || seedValues.length !== 1) {
    return null;
  }

  const levelId = levelValues[0];
  const seedText = seedValues[0];
  if (!levelId || seedText === undefined || seedText.trim() === '') {
    return null;
  }
  if (!/^\d+$/.test(seedText)) {
    return null;
  }
  if (seedText.length > 16) {
    return null;
  }

  const seed = Number(seedText);
  if (!Number.isSafeInteger(seed) || seed < 0) {
    return null;
  }
  if (getPlayableLevelContent(levelId) === null) {
    return null;
  }

  return { levelId, seed };
}

export function formatPlaytestSeedLabel(seed: number): string {
  return `Playtest seed ${seed}`;
}
