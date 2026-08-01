import { type SeedProvider } from '../content/levelCatalog';

const MAX_BROWSER_SEED = 1_000_000_000;

export function createBrowserSeedProvider(): SeedProvider {
  return {
    nextSeed(): number {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return values[0] % MAX_BROWSER_SEED;
    },
  };
}
