/* global URLSearchParams, process */
import { expect, type Locator, type Page } from '@playwright/test';

export interface E2EPageOptions {
  fixture?: string;
  scenario?: string;
  debugPerformance?: boolean;
  safeAreaTest?: boolean;
  level?: string;
  seed?: number;
}

export const statusSelector = '#storycrush-test-status';

/** Base URL actually used by Playwright (local webServer or PLAYWRIGHT_BASE_URL). */
export function getBrowserBaseURL(): string {
  return process.env.PLAYWRIGHT_BASE_URL?.trim() || 'http://127.0.0.1:4180';
}

export function buildE2EUrl(options: E2EPageOptions = {}): string {
  const query = new URLSearchParams([['e2e', '1']]);
  if (options.debugPerformance) query.set('debugPerformance', '1');
  if (options.safeAreaTest) query.set('safeAreaTest', '1');
  if (options.fixture) query.set('fixture', options.fixture);
  if (options.scenario) query.set('scenario', options.scenario);
  if (options.level) query.set('level', options.level);
  if (options.seed !== undefined) query.set('seed', String(options.seed));
  return `/?${query.toString()}`;
}

/** Ordinary app root with e2e diagnostics only — not a direct puzzle deep-link. */
export function buildNormalFlowUrl(): string {
  return '/?e2e=1';
}

export async function clickSceneRatio(page: Page, xRatio: number, yRatio: number): Promise<void> {
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  await canvas.click({ position: { x: bounds.width * xRatio, y: bounds.height * yRatio } });
}

/** Click a shell primary action using published presentation ratios when available. */
export async function clickPublishedAction(
  page: Page,
  attribute: 'map-enter-ratio' | 'primary-action-ratio' | 'continue-action-ratio',
  fallback: { x: number; y: number },
): Promise<void> {
  const raw = await getTestStatus(page).getAttribute(`data-${attribute}`);
  if (raw) {
    const [x, y] = raw.split(',').map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      await clickSceneRatio(page, x, y);
      return;
    }
  }
  await clickSceneRatio(page, fallback.x, fallback.y);
}

async function statusNumber(page: Page, name: string): Promise<number> {
  const value = await getTestStatus(page).getAttribute(`data-${name}`);
  if (value === null || Number.isNaN(Number(value))) {
    throw new Error(`Expected numeric data-${name}`);
  }
  return Number(value);
}

/** Assert window / game-root / Phaser / canvas CSS stay synchronized (presentation truth). */
export async function assertViewportSynchronized(
  page: Page,
  expectedWidth: number,
  tolerance = 2,
): Promise<void> {
  await expect
    .poll(async () => {
      const status = getTestStatus(page);
      const gameRootWidth = Number(await status.getAttribute('data-game-root-width'));
      const phaserWidth = Number(await status.getAttribute('data-phaser-scale-width'));
      const canvasCssWidth = Number(await status.getAttribute('data-canvas-css-width'));
      const windowInnerWidth = Number(await status.getAttribute('data-window-inner-width'));
      if (
        ![gameRootWidth, phaserWidth, canvasCssWidth, windowInnerWidth].every((value) =>
          Number.isFinite(value),
        )
      ) {
        return 'pending';
      }
      const synced =
        Math.abs(gameRootWidth - expectedWidth) <= tolerance &&
        Math.abs(phaserWidth - gameRootWidth) <= tolerance &&
        Math.abs(canvasCssWidth - gameRootWidth) <= tolerance &&
        Math.abs(windowInnerWidth - expectedWidth) <= tolerance &&
        phaserWidth !== 960;
      return synced
        ? 'ok'
        : `root=${gameRootWidth} phaser=${phaserWidth} css=${canvasCssWidth} inner=${windowInnerWidth}`;
    })
    .toBe('ok');

  const phaserWidth = await statusNumber(page, 'phaser-scale-width');
  const safeWidth = Number(
    (await getTestStatus(page).getAttribute('data-safe-width')) ?? Number.NaN,
  );
  if (Number.isFinite(safeWidth)) {
    expect(safeWidth).toBeLessThanOrEqual(phaserWidth + tolerance);
  }
}

/** Measure active-scene Text/Image bounds and ensure they stay inside the logical width. */
export async function assertActiveSceneContentWithinWidth(
  page: Page,
  maxWidth: number,
  gutter = 4,
): Promise<void> {
  const report = await page.evaluate((limit) => {
    const game = window.__storyCrushGame as
      | {
          scene: {
            getScenes: (active: boolean) => Array<{
              children: { list: unknown[] };
            }>;
          };
        }
      | undefined;
    if (!game) return { ok: false, reason: 'no-game', offenders: [] as string[] };
    const scene = game.scene.getScenes(true)[0];
    if (!scene) return { ok: false, reason: 'no-scene', offenders: [] as string[] };
    const offenders: string[] = [];
    const visit = (object: unknown) => {
      const anyObject = object as {
        getBounds?: () => { left: number; right: number };
        list?: unknown[];
        text?: string;
        type?: string;
        active?: boolean;
        visible?: boolean;
      };
      if (anyObject.visible === false || anyObject.active === false) {
        return;
      }
      // Only assert Text objects — Graphics/Container bounds are often decorative
      // or union boxes and are not the readable overflow signal for phones.
      if (anyObject.type === 'Text' && typeof anyObject.getBounds === 'function') {
        const bounds = anyObject.getBounds();
        if (bounds.right > limit + 0.5 || bounds.left < -0.5) {
          const label =
            typeof anyObject.text === 'string'
              ? anyObject.text.slice(0, 48)
              : (anyObject.type ?? 'object');
          offenders.push(
            `${label}:${Math.round(bounds.left)}..${Math.round(bounds.right)}>${limit}`,
          );
        }
      }
      if (Array.isArray(anyObject.list)) {
        anyObject.list.forEach(visit);
      }
    };
    scene.children.list.forEach(visit);
    return { ok: offenders.length === 0, reason: 'bounds', offenders };
  }, maxWidth + gutter);

  expect(report.ok, report.offenders.join(' | ')).toBe(true);
}

export interface PlaytestUrlOptions {
  level: string;
  seed: number;
}

/** Human playtest launch URL — intentionally omits e2e=1. */
export function buildPlaytestUrl(options: PlaytestUrlOptions): string {
  const query = new URLSearchParams([
    ['playtest', '1'],
    ['level', options.level],
    ['seed', String(options.seed)],
  ]);
  return `/?${query.toString()}`;
}

export function getTestStatus(page: Page): Locator {
  return page.locator(statusSelector);
}

export async function waitForSceneReady(
  page: Page,
  scene:
    | 'main-menu'
    | 'puzzle-lab'
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
