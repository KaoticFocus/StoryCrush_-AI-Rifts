import { describe, expect, it } from 'vitest';
import { parseBrowserTestOptions } from '../../../src/game/presentation/testing/browserTestOptions';

describe('parseBrowserTestOptions', () => {
  it('keeps normal gameplay free of E2E instrumentation', () => {
    expect(parseBrowserTestOptions('?fixture=fast-gravity')).toEqual({
      e2eEnabled: false,
      performanceDiagnosticsEnabled: false,
      safeAreaSimulationEnabled: false,
    });
  });

  it('enables read-only status under e2e=1 without performance diagnostics', () => {
    expect(parseBrowserTestOptions('?e2e=1&fixture=fast-gravity')).toEqual({
      e2eEnabled: true,
      performanceDiagnosticsEnabled: false,
      safeAreaSimulationEnabled: false,
    });
  });

  it('requires e2e=1 before enabling performance diagnostics', () => {
    expect(parseBrowserTestOptions('?debugPerformance=1')).toEqual({
      e2eEnabled: false,
      performanceDiagnosticsEnabled: false,
      safeAreaSimulationEnabled: false,
    });
    expect(parseBrowserTestOptions('?e2e=1&debugPerformance=1')).toEqual({
      e2eEnabled: true,
      performanceDiagnosticsEnabled: true,
      safeAreaSimulationEnabled: false,
    });
  });

  it('requires E2E enablement before applying safe-area simulation', () => {
    expect(parseBrowserTestOptions('?safeAreaTest=1').safeAreaSimulationEnabled).toBe(false);
    expect(parseBrowserTestOptions('?e2e=1&safeAreaTest=1').safeAreaSimulationEnabled).toBe(true);
  });
});
