import { expect, test, type Page } from '@playwright/test';
import { type BoardCoordinate } from '../../src/game/board';
import { calculatePuzzleLayout } from '../../src/game/presentation/puzzleLayout';
import {
  boardCoordinateToBrowserCanvasPoint,
  type BrowserBoardGeometry,
} from '../../src/game/presentation/testing/browserCanvasGeometry';
const statusSelector = '#storycrush-test-status';

interface BrowserErrors {
  assertNone(): void;
}
function collectBrowserErrors(page: Page): BrowserErrors {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return {
    assertNone: () => {
      const unexpectedErrors = errors.filter((error) => !error.includes('drawImage'));
      expect(unexpectedErrors).toEqual([]);
    },
  };
}
async function getStatusNumber(page: Page, name: string): Promise<number> {
  const value = await page.locator(statusSelector).getAttribute(`data-${name}`);
  if (value === null) throw new Error(`Expected status data-${name}`);
  return Number(value);
}

async function getRequiredStatusAttribute(page: Page, name: string): Promise<string> {
  const value = await page.locator(statusSelector).getAttribute(`data-${name}`);
  if (value === null) throw new Error(`Expected status data-${name}`);
  return value;
}

async function getBoardGeometry(page: Page): Promise<BrowserBoardGeometry> {
  return {
    logicalCanvasWidth: await getStatusNumber(page, 'logical-canvas-width'),
    logicalCanvasHeight: await getStatusNumber(page, 'logical-canvas-height'),
    boardX: await getStatusNumber(page, 'board-x'),
    boardY: await getStatusNumber(page, 'board-y'),
    cellSize: await getStatusNumber(page, 'cell-size'),
    rows: await getStatusNumber(page, 'board-rows'),
    columns: await getStatusNumber(page, 'board-columns'),
  };
}
interface CanvasBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function clickCanvasPoint(
  page: Page,
  point: { x: number; y: number },
  bounds?: CanvasBounds,
) {
  const canvasBounds = bounds ?? (await page.locator('canvas').boundingBox());
  if (!canvasBounds) throw new Error('Expected Phaser canvas bounds');
  await page.mouse.click(canvasBounds.x + point.x, canvasBounds.y + point.y);
}

async function clickMainMenuPlay(page: Page) {
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  await clickCanvasPoint(page, { x: bounds.width / 2, y: bounds.height / 2 }, bounds);
}

async function clickHudButton(page: Page, key: 'restart' | 'menu' | 'mode') {
  const geometry = await getBoardGeometry(page);
  const layout = calculatePuzzleLayout({
    width: geometry.logicalCanvasWidth,
    height: geometry.logicalCanvasHeight,
    rows: geometry.rows,
    columns: geometry.columns,
  });
  const buttonIndex = key === 'restart' ? 0 : key === 'menu' ? 1 : 2;
  const buttonGap = 8;
  const buttonWidth = Math.max(92, Math.floor((layout.footerRect.width - 36 - buttonGap * 2) / 3));
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  await clickCanvasPoint(
    page,
    {
      x:
        ((layout.footerRect.x + 18 + buttonIndex * (buttonWidth + buttonGap) + buttonWidth / 2) /
          geometry.logicalCanvasWidth) *
        bounds.width,
      y: ((layout.footerRect.y + 26) / geometry.logicalCanvasHeight) * bounds.height,
    },
    bounds,
  );
}

async function enterFixture(page: Page, fixtureId: string, preserveStorage = false) {
  const errors = collectBrowserErrors(page);
  await page.goto(`/?e2e=1&fixture=${fixtureId}`);
  if (!preserveStorage) await page.evaluate(() => window.localStorage.clear());
  const status = page.locator(statusSelector);
  await expect(status).toHaveAttribute('data-scene', 'main-menu');
  await clickMainMenuPlay(page);
  await expect(status).toHaveAttribute('data-scene', 'puzzle');
  await expect(status).toHaveAttribute('data-fixture-id', fixtureId);
  await expect(status).toHaveAttribute('data-playback-state', 'idle');
  await expect(status).toHaveAttribute('data-render-consistency', 'passed');
  return errors;
}

async function enterFixtureWithDiagnostics(page: Page, fixtureId: string) {
  const errors = collectBrowserErrors(page);
  await page.goto(`/?e2e=1&debugPerformance=1&fixture=${fixtureId}`);
  await page.evaluate(() => window.localStorage.clear());
  const status = page.locator(statusSelector);
  await expect(status).toHaveAttribute('data-scene', 'main-menu');
  await clickMainMenuPlay(page);
  await expect(status).toHaveAttribute('data-scene', 'puzzle');
  return errors;
}

async function selectPlaybackMode(page: Page, mode: 'fast' | 'instant') {
  const status = page.locator(statusSelector);
  while ((await status.getAttribute('data-playback-mode')) !== mode) {
    await clickHudButton(page, 'mode');
  }
  await expect(status).toHaveAttribute('data-playback-mode', mode);
}

async function submitExpectedFixtureMove(page: Page, expectsVisiblePlayback = true) {
  const status = page.locator(statusSelector);
  const sequenceBefore = await getStatusNumber(page, 'playback-sequence');
  const from = (await status.getAttribute('data-expected-move-from'))?.split(':').map(Number);
  const to = (await status.getAttribute('data-expected-move-to'))?.split(':').map(Number);
  if (!from || !to || from.length !== 2 || to.length !== 2) {
    throw new Error('Expected fixture move coordinates in status bridge');
  }

  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  const geometry = await getBoardGeometry(page);
  const pointFor = (coordinate: BoardCoordinate) =>
    boardCoordinateToBrowserCanvasPoint({
      coordinate,
      geometry,
      canvasBounds: { width: bounds.width, height: bounds.height },
    });

  await clickCanvasPoint(page, pointFor({ row: from[0], column: from[1] }), bounds);
  await expect(status).toHaveAttribute('data-selected-coordinate', `${from[0]}:${from[1]}`);
  await clickCanvasPoint(page, pointFor({ row: to[0], column: to[1] }), bounds);
  await expect(status).toHaveAttribute('data-playback-sequence', String(sequenceBefore + 1));
  await expect(status).toHaveAttribute('data-last-move-accepted', 'true');
  if (expectsVisiblePlayback) {
    await expect(status).toHaveAttribute('data-playback-state', 'playing');
  }
}

async function expectFixtureCompletion(page: Page) {
  const status = page.locator(statusSelector);
  await expect(status).toHaveAttribute('data-playback-state', /^(completed|idle)$/);
  await expect(status).toHaveAttribute('data-render-consistency', 'passed');
  await expect(status).toHaveAttribute(
    'data-authoritative-board-hash',
    await getRequiredStatusAttribute(page, 'rendered-board-hash'),
  );
  await expect(status).toHaveAttribute(
    'data-score',
    await getRequiredStatusAttribute(page, 'fixture-expected-score-after'),
  );
  await expect(status).toHaveAttribute(
    'data-moves-remaining',
    await getRequiredStatusAttribute(page, 'fixture-expected-moves-after'),
  );
  await expect(status).toHaveAttribute(
    'data-objectives-hash',
    await getRequiredStatusAttribute(page, 'fixture-expected-objectives-hash'),
  );
  await expect(status).toHaveAttribute('data-hard-sync-recovery-count', '0');
  await expect(status).toHaveAttribute('data-last-error-code', 'none');
  await expect(status).toHaveAttribute('data-input-locked', 'false');
}

for (const mode of ['fast', 'instant'] as const) {
  test(`${mode} fixture playback completes through real canvas input`, async ({ page }) => {
    test.setTimeout(60_000);
    const fixtureId = mode === 'fast' ? 'fast-gravity' : 'instant-resolution';
    const errors = await enterFixture(page, fixtureId);
    const status = page.locator(statusSelector);
    await selectPlaybackMode(page, mode);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(status).toHaveAttribute('data-scene', 'main-menu');
    await clickMainMenuPlay(page);
    await expect(status).toHaveAttribute('data-fixture-id', fixtureId);
    await expect(status).toHaveAttribute('data-playback-mode', mode);

    await submitExpectedFixtureMove(page, mode !== 'instant');
    await expect(status).toHaveAttribute('data-command-trace', /remove-pieces/);
    await expect(status).toHaveAttribute('data-command-trace', /apply-gravity/);
    await expect(status).toHaveAttribute('data-command-trace', /refill-pieces/);
    await expectFixtureCompletion(page);
    errors.assertNone();
  });
}

test('wildcard pair resolves through real canvas input and chains the fixture special', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = await enterFixture(page, 'wildcard-pair');
  const status = page.locator(statusSelector);
  await expect(status).toHaveAttribute('data-expected-move-source-kinds', 'wildcard,wildcard');
  await expect(status).toHaveAttribute('data-fixture-special-count', '6');
  await submitExpectedFixtureMove(page);
  await expect(status).toHaveAttribute('data-command-trace', /special-activation/);
  await expect(status).toHaveAttribute('data-last-activation-index', '2');
  await expect(status).toHaveAttribute('data-command-trace', /remove-pieces/);
  await expectFixtureCompletion(page);
  errors.assertNone();
});

test('restart, resize, and menu exit safely cancel fast playback through real UI', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors = await enterFixture(page, 'fast-gravity');
  const status = page.locator(statusSelector);

  await selectPlaybackMode(page, 'fast');
  await submitExpectedFixtureMove(page);
  await clickHudButton(page, 'restart');
  await expect(status).toHaveAttribute('data-playback-state', 'idle');
  await expect(status).toHaveAttribute('data-input-locked', 'false');

  await submitExpectedFixtureMove(page);
  await page.setViewportSize({ width: 1180, height: 680 });
  await expect(status).toHaveAttribute('data-playback-state', 'idle');
  await expect(status).toHaveAttribute('data-render-consistency', 'passed');

  await clickHudButton(page, 'restart');
  await expect(status).toHaveAttribute('data-playback-state', 'idle');
  await submitExpectedFixtureMove(page);
  await page.locator('canvas').press('KeyM');
  await expect(status).toHaveAttribute('data-scene', 'main-menu');
  errors.assertNone();
});

test('hint, pause, and persisted playback preferences work without page errors', async ({
  page,
}) => {
  test.setTimeout(45_000);
  const errors = await enterFixture(page, 'fast-gravity');
  const status = page.locator(statusSelector);
  await page.locator('canvas').press('H');
  await expect(status).toHaveAttribute('data-has-active-hint', 'true');
  await page.locator('canvas').press('Escape');
  await expect(status).toHaveAttribute('data-paused', 'true');
  await page.locator('canvas').press('Escape');
  await selectPlaybackMode(page, 'fast');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(status).toHaveAttribute('data-scene', 'main-menu');
  await clickMainMenuPlay(page);
  await expect(status).toHaveAttribute('data-playback-mode', 'fast');
  errors.assertNone();
});

test('diagnostics capture a bounded cleanup sample and ARIA announces authoritative feedback', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors = await enterFixtureWithDiagnostics(page, 'fast-gravity');
  const status = page.locator(statusSelector);
  await page.locator('canvas').press('H');
  await expect(page.locator('#storycrush-status')).toContainText('Hint: swap row');
  await submitExpectedFixtureMove(page);
  await expectFixtureCompletion(page);
  await expect(page.locator('#storycrush-status')).toContainText('Move accepted');

  const serialized = await getRequiredStatusAttribute(page, 'performance-sample');
  const sample = JSON.parse(serialized) as {
    frameCount: number;
    playbackDurationMs: number;
    resourcesAfter: { activeTweens: number; activeTimers: number; temporaryObjects: number };
  };
  expect(sample.frameCount).toBeGreaterThan(0);
  expect(sample.playbackDurationMs).toBeGreaterThan(0);
  expect(sample.resourcesAfter).toEqual({ activeTweens: 0, activeTimers: 0, temporaryObjects: 0 });
  errors.assertNone();
});

test('restart, navigation, and resize soaks preserve the stable resource baseline', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await enterFixture(page, 'instant-resolution');
  const status = page.locator(statusSelector);
  const baseline = {
    displayObjects: await getStatusNumber(page, 'display-objects'),
    boardPieces: await getStatusNumber(page, 'board-piece-count'),
    listeners: await getStatusNumber(page, 'listener-count'),
  };

  for (let index = 0; index < 25; index += 1) {
    await clickHudButton(page, 'restart');
    await expect(status).toHaveAttribute('data-playback-state', 'idle');
  }

  for (let index = 0; index < 20; index += 1) {
    await clickHudButton(page, 'menu');
    await expect(status).toHaveAttribute('data-scene', 'main-menu');
    await clickMainMenuPlay(page);
    await expect(status).toHaveAttribute('data-scene', 'puzzle');
  }

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 412, height: 915 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    const geometry = await getBoardGeometry(page);
    expect(geometry.cellSize).toBeGreaterThanOrEqual(24);
  }

  expect(await getStatusNumber(page, 'display-objects')).toBe(baseline.displayObjects);
  expect(await getStatusNumber(page, 'board-piece-count')).toBe(baseline.boardPieces);
  expect(await getStatusNumber(page, 'listener-count')).toBe(baseline.listeners);
  expect(await getStatusNumber(page, 'temporary-object-count')).toBe(0);
  expect(await getStatusNumber(page, 'active-tween-count')).toBe(0);
  expect(await getStatusNumber(page, 'active-timer-count')).toBe(0);
  errors.assertNone();
});
