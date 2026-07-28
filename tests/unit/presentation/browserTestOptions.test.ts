import { describe, expect, it } from 'vitest';
import { parseBrowserTestOptions } from '../../../src/game/presentation/testing/browserTestOptions';

describe('parseBrowserTestOptions', () => {
  it('keeps normal gameplay free of E2E instrumentation', () => {
    expect(parseBrowserTestOptions('?fixture=fast-gravity')).toEqual({
      e2eEnabled: false,
      performanceDiagnosticsEnabled: false,
    });
  });

  it('enables read-only status under e2e=1 without performance diagnostics', () => {
    expect(parseBrowserTestOptions('?e2e=1&fixture=fast-gravity')).toEqual({
      e2eEnabled: true,
      performanceDiagnosticsEnabled: false,
    });
  });

  it('requires e2e=1 before enabling performance diagnostics', () => {
    expect(parseBrowserTestOptions('?debugPerformance=1')).toEqual({
      e2eEnabled: false,
      performanceDiagnosticsEnabled: false,
    });
    expect(parseBrowserTestOptions('?e2e=1&debugPerformance=1')).toEqual({
      e2eEnabled: true,
      performanceDiagnosticsEnabled: true,
    });
  });
});
