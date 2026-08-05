import { describe, expect, it } from 'vitest';
import {
  getBrowserScenario,
  getBrowserScenarios,
} from '../../../src/game/content/testing/browserScenarios';
import { getBrowserFixture } from '../../../src/game/content/testing/browserFixtures';

describe('browser scenarios', () => {
  it('defines every required B1 scenario with an existing deterministic fixture', () => {
    const scenarios = getBrowserScenarios();
    expect(scenarios).toHaveLength(27);
    for (const scenario of scenarios) {
      expect(getBrowserFixture(scenario.fixtureId)).not.toBeNull();
      expect(scenario.expectedFeatures.length).toBeGreaterThan(0);
    }
  });

  it('returns null for unknown scenario identifiers', () => {
    expect(getBrowserScenario('unknown')).toBeNull();
  });
});
