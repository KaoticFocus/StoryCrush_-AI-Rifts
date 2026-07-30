/* global URLSearchParams */
import { expect, type Locator, type Page } from '@playwright/test';

export interface E2EPageOptions {
  fixture?: string;
  scenario?: string;
  debugPerformance?: boolean;
  safeAreaTest?: boolean;
}

export const statusSelector = '#storycrush-test-status';

export function buildE2EUrl(options: E2EPageOptions = {}): string {
  const query = new URLSearchParams([['e2e', '1']]);
  if (options.debugPerformance) query.set('debugPerformance', '1');
  if (options.safeAreaTest) query.set('safeAreaTest', '1');
  if (options.fixture) query.set('fixture', options.fixture);
  if (options.scenario) query.set('scenario', options.scenario);
  return `/?${query.toString()}`;
}

export function getTestStatus(page: Page): Locator {
  return page.locator(statusSelector);
}

export async function waitForSceneReady(
  page: Page,
  scene:
    | 'main-menu'
    | 'puzzle'
    | 'multiverse-map'
    | 'chapter-intro'
    | 'dialogue'
    | 'story-choice'
    | 'results'
    | 'consequence',
): Promise<Locator> {
  const status = getTestStatus(page);
  await expect(status).toHaveAttribute('data-scene', scene);
  if (scene === 'puzzle') {
    await expect(status).toHaveAttribute('data-playback-state', 'idle');
    await expect(status).toHaveAttribute('data-render-consistency', 'passed');
  }
  return status;
}

export async function waitForDiagnosticsReady(page: Page): Promise<Locator> {
  const status = getTestStatus(page);
  await expect(status).not.toHaveAttribute('data-diagnostics-state', 'error');
  await expect(status).toHaveAttribute('data-diagnostics-state', 'ready');
  for (const name of ['display-objects', 'board-piece-count', 'listener-count']) {
    await expect(status).toHaveAttribute(`data-${name}`, /^\d+$/);
  }
  return status;
}

export async function readResourceSnapshot(page: Page): Promise<Record<string, number>> {
  const status = await waitForDiagnosticsReady(page);
  const names = [
    'display-objects',
    'board-piece-count',
    'temporary-object-count',
    'active-tween-count',
    'active-timer-count',
    'listener-count',
  ];
  const entries = await Promise.all(
    names.map(async (name) => {
      const value = await status.getAttribute(`data-${name}`);
      if (value === null || !/^\d+$/.test(value))
        throw new Error(`Diagnostics missing numeric ${name}`);
      return [name, Number(value)] as const;
    }),
  );
  return Object.fromEntries(entries);
}
