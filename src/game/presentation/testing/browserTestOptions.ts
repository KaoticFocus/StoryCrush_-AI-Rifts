/* global URLSearchParams */
export interface BrowserTestOptions {
  e2eEnabled: boolean;
  performanceDiagnosticsEnabled: boolean;
  safeAreaSimulationEnabled: boolean;
}

export function parseBrowserTestOptions(search: string): BrowserTestOptions {
  const query = new URLSearchParams(search);
  const e2eEnabled = query.get('e2e') === '1';

  return {
    e2eEnabled,
    performanceDiagnosticsEnabled: e2eEnabled && query.get('debugPerformance') === '1',
    safeAreaSimulationEnabled: e2eEnabled && query.get('safeAreaTest') === '1',
  };
}

export function getBrowserTestOptions(): BrowserTestOptions {
  return parseBrowserTestOptions(window.location.search);
}
