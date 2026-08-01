import { expect, test, type Page } from '@playwright/test';
import { type BoardCoordinate } from '../../src/game/board';
import { calculatePuzzleLayout } from '../../src/game/presentation/puzzleLayout';
import {
  boardCoordinateToBrowserCanvasPoint,
  type BrowserBoardGeometry,
} from '../../src/game/presentation/testing/browserCanvasGeometry';
import {
  buildE2EUrl,
  getTestStatus,
  readResourceSnapshot,
  statusSelector,
  waitForDiagnosticsReady,
  waitForSceneReady,
} from './browserTestHelpers';

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
  touch = false,
) {
  const canvas = page.locator('canvas');
  const canvasBounds = bounds ?? (await canvas.boundingBox());
  if (!canvasBounds) throw new Error('Expected Phaser canvas bounds');
  if (touch) {
    await page.touchscreen.tap(canvasBounds.x + point.x, canvasBounds.y + point.y);
    return;
  }
  await canvas.click({ position: { x: point.x, y: point.y } });
}

async function clickMainMenuPlay(page: Page) {
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  await clickCanvasPoint(page, { x: bounds.width / 2, y: bounds.height / 2 }, bounds);
}

async function clickHudButton(
  page: Page,
  key: 'restart' | 'menu' | 'mode' | 'motion' | 'hint' | 'pause',
) {
  const geometry = await getBoardGeometry(page);
  const layout = calculatePuzzleLayout({
    width: geometry.logicalCanvasWidth,
    height: geometry.logicalCanvasHeight,
    rows: geometry.rows,
    columns: geometry.columns,
  });
  const buttonIndex = ['restart', 'menu', 'mode', 'motion', 'hint', 'pause'].indexOf(key);
  const buttonGap = 8;
  const buttonWidth = Math.max(92, Math.floor((layout.footerRect.width - 36 - buttonGap * 2) / 3));
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  await clickCanvasPoint(
    page,
    {
      x:
        ((layout.footerRect.x +
          18 +
          (buttonIndex % 3) * (buttonWidth + buttonGap) +
          buttonWidth / 2) /
          geometry.logicalCanvasWidth) *
        bounds.width,
      y:
        ((layout.footerRect.y + 42 + Math.floor(buttonIndex / 3) * 44 + 18) /
          geometry.logicalCanvasHeight) *
        bounds.height,
    },
    bounds,
  );
}

async function enterFixture(page: Page, fixtureId: string, preserveStorage = false) {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl({ fixture: fixtureId }));
  if (!preserveStorage) await page.evaluate(() => window.localStorage.clear());
  const status = getTestStatus(page);
  await waitForSceneReady(page, 'main-menu');
  await clickMainMenuPlay(page);
  await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-fixture-id', fixtureId);
  await expect(status).toHaveAttribute('data-playback-state', 'idle');
  await expect(status).toHaveAttribute('data-render-consistency', 'passed');
  return errors;
}

async function enterFixtureWithDiagnostics(page: Page, fixtureId: string) {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl({ fixture: fixtureId, debugPerformance: true }));
  await page.evaluate(() => window.localStorage.clear());
  await waitForSceneReady(page, 'main-menu');
  await clickMainMenuPlay(page);
  await waitForSceneReady(page, 'puzzle');
  await waitForDiagnosticsReady(page);
  return errors;
}

async function selectPlaybackMode(page: Page, mode: 'normal' | 'fast' | 'instant') {
  while ((await getTestStatus(page).getAttribute('data-playback-mode')) !== mode) {
    await clickHudButton(page, 'mode');
  }
  await expect(getTestStatus(page)).toHaveAttribute('data-playback-mode', mode);
}

async function expectStableResources(page: Page, baseline: Record<string, number>) {
  const resources = await readResourceSnapshot(page);
  for (const resourceName of [
    'board-piece-count',
    'temporary-object-count',
    'active-timer-count',
    'listener-count',
  ] as const) {
    expect(resources[resourceName]).toBe(baseline[resourceName]);
  }
  return resources;
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

async function expectFixtureCompletion(page: Page, timeout = 5_000) {
  const status = page.locator(statusSelector);
  await expect(status).toHaveAttribute('data-playback-state', /^(completed|idle)$/, { timeout });
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

for (const [id, fixtureId, sourceKinds] of [
  ['B1-FX-004', 'line-area-combination', 'line-clear,area-clear'],
  ['B1-FX-005', 'wildcard-target', 'wildcard,standard'],
] as const) {
  test(`${id} resolves ${fixtureId} through real canvas input`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = await enterFixture(page, fixtureId);
    const status = page.locator(statusSelector);
    await expect(status).toHaveAttribute('data-expected-move-source-kinds', sourceKinds);
    await submitExpectedFixtureMove(page);
    await expect(status).toHaveAttribute('data-command-trace', /special-activation/);
    await expectFixtureCompletion(page, fixtureId === 'wildcard-target' ? 15_000 : 5_000);
    errors.assertNone();
  });
}

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

test('mobile touch selects once and submits exactly one swap', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const errors = await enterFixture(page, 'instant-resolution');
  const status = getTestStatus(page);
  const sequenceBefore = await getStatusNumber(page, 'playback-sequence');
  const from = (await status.getAttribute('data-expected-move-from'))?.split(':').map(Number);
  const to = (await status.getAttribute('data-expected-move-to'))?.split(':').map(Number);
  if (!from || !to) throw new Error('Expected fixture move coordinates');
  const bounds = await page.locator('canvas').boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  const geometry = await getBoardGeometry(page);
  const pointFor = (coordinate: BoardCoordinate) =>
    boardCoordinateToBrowserCanvasPoint({
      coordinate,
      geometry,
      canvasBounds: { width: bounds.width, height: bounds.height },
    });
  const touch = testInfo.project.name === 'chromium-mobile';

  await clickCanvasPoint(page, pointFor({ row: from[0], column: from[1] }), bounds, touch);
  await expect(status).toHaveAttribute('data-selected-coordinate', `${from[0]}:${from[1]}`);
  await clickCanvasPoint(page, pointFor({ row: to[0], column: to[1] }), bounds, touch);
  await expect(status).toHaveAttribute('data-playback-sequence', String(sequenceBefore + 1));
  await expect(status).toHaveAttribute('data-last-move-accepted', 'true');
  await expectFixtureCompletion(page);
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
  await page.locator('canvas').press('H');
  await expect(page.locator('#storycrush-status')).toContainText('Hint: swap row');
  await submitExpectedFixtureMove(page);
  await expectFixtureCompletion(page);
  await expect(page.locator('#storycrush-status')).toContainText('Move accepted');

  await expect(getTestStatus(page)).toHaveAttribute('data-performance-sample', /.+/);
  const serialized = await getRequiredStatusAttribute(page, 'performance-sample');
  const sample = JSON.parse(serialized) as {
    frameCount: number;
    playbackDurationMs: number;
    resourcesAfter: { activeTweens: number; activeTimers: number; temporaryObjects: number };
  };
  expect(sample.frameCount).toBeGreaterThan(0);
  expect(sample.playbackDurationMs).toBeGreaterThan(0);
  expect(sample.resourcesAfter).toMatchObject({ activeTimers: 0, temporaryObjects: 0 });
  expect(sample.resourcesAfter.activeTweens).toBeGreaterThanOrEqual(0);
  errors.assertNone();
});

test('normal E2E mode exposes basic status without diagnostics', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl({ fixture: 'fast-gravity' }));
  await waitForSceneReady(page, 'main-menu');
  await clickMainMenuPlay(page);
  const status = await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-diagnostics-state', 'disabled');
  await expect(status).not.toHaveAttribute('data-display-objects');
  await expect(status).not.toHaveAttribute('data-performance-sample');
  errors.assertNone();
});

test('diagnostics E2E mode publishes an initial resource baseline', async ({ page }) => {
  const errors = await enterFixtureWithDiagnostics(page, 'instant-resolution');
  const resources = await readResourceSnapshot(page);
  expect(resources['display-objects']).toBeGreaterThan(0);
  expect(resources['board-piece-count']).toBe(64);
  expect(resources['temporary-object-count']).toBe(0);
  expect(resources['active-timer-count']).toBe(0);
  errors.assertNone();
});

test('B1-SK-001 lifecycle resources return to baseline through restart and resize before menu exit', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = await enterFixtureWithDiagnostics(page, 'fast-gravity');
  const baseline = await readResourceSnapshot(page);
  const stableResourceNames = [
    'board-piece-count',
    'temporary-object-count',
    'active-timer-count',
    'listener-count',
  ] as const;
  const initialViewport = page.viewportSize();
  if (!initialViewport) throw new Error('Expected configured Playwright viewport');

  for (let iteration = 0; iteration < 3; iteration += 1) {
    await clickHudButton(page, 'restart');
    await expect(getTestStatus(page)).toHaveAttribute('data-playback-state', 'idle');

    await page.setViewportSize({
      width: initialViewport.width - (iteration + 1) * 8,
      height: initialViewport.height - (iteration + 1) * 8,
    });
    await expect(getTestStatus(page)).toHaveAttribute('data-render-consistency', 'passed');

    const resources = await readResourceSnapshot(page);
    for (const resourceName of stableResourceNames)
      expect(resources[resourceName]).toBe(baseline[resourceName]);
  }

  await page.locator('canvas').press('KeyM');
  await waitForSceneReady(page, 'main-menu');
  errors.assertNone();
});

test('B1-SC-001 scenario metadata selects its E2E-gated fixture and remains read-only', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl({ scenario: 'reduced-motion' }));
  await waitForSceneReady(page, 'main-menu');
  await clickMainMenuPlay(page);
  const status = await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-scenario-id', 'reduced-motion');
  await expect(status).toHaveAttribute('data-fixture-id', 'line-area-combination');
  await expect(status).toHaveAttribute('data-scenario-features', /reduced-motion/);
  errors.assertNone();
});

for (const [scenario, fixture, mode, reducedMotion] of [
  ['ordinary-match', 'fast-gravity', 'normal', false],
  ['fast-gravity', 'fast-gravity', 'fast', false],
  ['instant-resolution', 'instant-resolution', 'instant', false],
  ['wildcard-pair', 'wildcard-pair', 'normal', false],
  ['reduced-motion', 'line-area-combination', 'normal', true],
] as const) {
  test(`B1-PF ${scenario} records a bounded performance sample`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = await enterFixtureWithDiagnostics(page, fixture);
    await selectPlaybackMode(page, mode);
    if (reducedMotion) {
      await clickHudButton(page, 'motion');
      await expect(getTestStatus(page)).toHaveAttribute('data-reduced-motion', 'true');
    }
    await submitExpectedFixtureMove(page, mode !== 'instant');
    await expectFixtureCompletion(page, scenario === 'wildcard-pair' ? 20_000 : 5_000);
    await expect(getTestStatus(page)).toHaveAttribute('data-performance-sample', /.+/);
    const serialized = await getRequiredStatusAttribute(page, 'performance-sample');
    const sample = JSON.parse(serialized) as {
      buildKind: string;
      frameCount: number;
      averageFrameMs: number;
      percentile95FrameMs: number;
      longestFrameMs: number;
      framesOver33Ms: number;
      framesOver50Ms: number;
      framesOver100Ms: number;
      playbackDurationMs: number;
      resourcesAfter: { temporaryObjects: number; activeTweens: number; activeTimers: number };
    };
    expect(sample.frameCount).toBeGreaterThanOrEqual(mode === 'instant' ? 0 : 1);
    expect(sample.playbackDurationMs).toBeGreaterThan(0);
    expect(sample.resourcesAfter).toMatchObject({
      temporaryObjects: 0,
      activeTweens: 0,
      activeTimers: 0,
    });
    console.log(`B1_PERFORMANCE_SAMPLE ${scenario} ${JSON.stringify(sample)}`);
    errors.assertNone();
  });
}

test('B1-SK-002 restart soak keeps deterministic resources stable for 25 cycles', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = await enterFixtureWithDiagnostics(page, 'fast-gravity');
  const baseline = await readResourceSnapshot(page);
  for (let iteration = 1; iteration <= 25; iteration += 1) {
    await clickHudButton(page, 'restart');
    await expect(getTestStatus(page)).toHaveAttribute('data-playback-state', 'idle');
    if (iteration % 5 === 0) await expectStableResources(page, baseline);
  }
  await expect(getTestStatus(page)).toHaveAttribute('data-hard-sync-recovery-count', '0');
  errors.assertNone();
});

test('B1-SK-003 navigation soak completes 20 menu to puzzle to menu cycles', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await enterFixture(page, 'fast-gravity');
  for (let iteration = 0; iteration < 20; iteration += 1) {
    await clickHudButton(page, 'menu');
    await waitForSceneReady(page, 'main-menu');
    await clickMainMenuPlay(page);
    await waitForSceneReady(page, 'puzzle');
    await expect(getTestStatus(page)).toHaveAttribute('data-render-consistency', 'passed');
  }
  errors.assertNone();
});

test('B1-SK-004 resize soak preserves stable state across required viewports', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await enterFixtureWithDiagnostics(page, 'fast-gravity');
  const baseline = await readResourceSnapshot(page);
  const viewports = [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
    { width: 1440, height: 900 },
  ];
  for (let iteration = 0; iteration < 10; iteration += 1) {
    await page.setViewportSize(viewports[iteration % viewports.length]);
    await expect(getTestStatus(page)).toHaveAttribute('data-render-consistency', 'passed');
    await expect(getTestStatus(page)).toHaveAttribute('data-input-locked', 'false');
    await expectStableResources(page, baseline);
  }
  errors.assertNone();
});

test('B1-SK-005 gameplay soak completes 20 accepted instant moves without recovery', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = await enterFixtureWithDiagnostics(page, 'instant-resolution');
  await selectPlaybackMode(page, 'instant');
  const baseline = await readResourceSnapshot(page);
  for (let iteration = 0; iteration < 20; iteration += 1) {
    await submitExpectedFixtureMove(page, false);
    await expectFixtureCompletion(page);
    await expectStableResources(page, baseline);
    if (iteration < 19) await clickHudButton(page, 'restart');
  }
  errors.assertNone();
});

test('B1-SK-006 hint, pause, and settings soak keeps controls singular and preferences scoped', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = await enterFixtureWithDiagnostics(page, 'fast-gravity');
  const baseline = await readResourceSnapshot(page);
  for (let iteration = 0; iteration < 25; iteration += 1) {
    await page.keyboard.press('H');
    await expect(getTestStatus(page)).toHaveAttribute('data-has-active-hint', 'true');
    await page.keyboard.press('Escape');
    await expect(getTestStatus(page)).toHaveAttribute('data-paused', 'true');
    await page.keyboard.press('Escape');
    await expect(getTestStatus(page)).toHaveAttribute('data-paused', 'false');
    if (iteration % 5 === 0) {
      await clickHudButton(page, 'mode');
      await clickHudButton(page, 'motion');
      await expectStableResources(page, baseline);
    }
  }
  const storageKeys = await page.evaluate(() => Object.keys(window.localStorage));
  expect(storageKeys).toEqual(['storycrush.prototype-settings.v1']);
  errors.assertNone();
});

test('normal production URL leaves test instrumentation inert', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto('/?fixture=fast-gravity');
  await expect(page.locator(statusSelector)).not.toHaveAttribute('data-scene');
  await clickMainMenuPlay(page);
  await expect(page.locator(statusSelector)).not.toHaveAttribute('data-fixture-id');
  errors.assertNone();
});
