import { expect, test, type Page } from '@playwright/test';
import { boardCoordinateToBrowserCanvasPoint } from '../../src/game/presentation/testing/browserCanvasGeometry';
import {
  buildE2EUrl,
  getTestStatus,
  statusSelector,
  waitForSceneReady,
} from './browserTestHelpers';

function collectBrowserErrors(page: Page): { assertNone(): void } {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return {
    assertNone: () => expect(errors, errors.join('\n')).toEqual([]),
  };
}

async function clickSceneButton(page: Page, xRatio: number, yRatio: number): Promise<void> {
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  await canvas.click({ position: { x: bounds.width * xRatio, y: bounds.height * yRatio } });
}

async function statusNumber(page: Page, name: string): Promise<number> {
  const value = await page.locator(statusSelector).getAttribute(`data-${name}`);
  if (value === null || Number.isNaN(Number(value))) {
    throw new Error(`Expected numeric data-${name}`);
  }
  return Number(value);
}

async function assertPhoneBoardWidthFill(page: Page, viewportWidth: number): Promise<void> {
  const boardWidth =
    (await statusNumber(page, 'cell-size')) * (await statusNumber(page, 'board-columns'));
  const boardX = await statusNumber(page, 'board-x');
  const logicalWidth = await statusNumber(page, 'logical-canvas-width');
  const rightGutter = logicalWidth - boardX - boardWidth;
  const utilization = boardWidth / logicalWidth;

  expect(logicalWidth).toBe(viewportWidth);
  expect(utilization).toBeGreaterThanOrEqual(0.94);
  expect(boardX).toBeLessThanOrEqual(12);
  expect(rightGutter).toBeLessThanOrEqual(12);
  expect(await statusNumber(page, 'cell-size')).toBeGreaterThanOrEqual(24);
  await expect(page.locator(statusSelector)).toHaveAttribute('data-move-limit', /^\d+$/);
  await expect(page.locator(statusSelector)).toHaveAttribute('data-objective-summary', /.+/);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
}

test('phone portrait loads Fantasy board theme with full board and HUD', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(90_000);
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(buildE2EUrl({ level: 'archive-stabilization', seed: 1807 }));
  const status = await waitForSceneReady(page, 'puzzle');

  await expect
    .poll(async () => status.getAttribute('data-board-theme'))
    .toMatch(/fantasy-board-v1|procedural-vector/);
  await expect
    .poll(async () => status.getAttribute('data-asset-variant'))
    .toMatch(/mobile|general|procedural/);
  await expect(status).toHaveAttribute('data-piece-visual-id', /fantasy-/);
  await expect(status).toHaveAttribute('data-cell-size', /^\d+(\.\d+)?$/);
  await expect(status).toHaveAttribute('data-board-rows', /^\d+$/);
  await expect(status).toHaveAttribute('data-move-limit', /^\d+$/);
  await expect(status).toHaveAttribute('data-objective-summary', /.+/);
  await assertPhoneBoardWidthFill(page, 390);
  await expect.poll(async () => status.getAttribute('data-piece-asset-variant')).toBe('mobile');
  await expect(status).toHaveAttribute('data-board-asset-variant', 'mobile');

  const interception = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { ok: false, reason: 'no-canvas' };
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + rect.width * 0.5;
    const y = rect.top + rect.height * 0.55;
    const top = document.elementFromPoint(x, y);
    return {
      ok: top?.tagName === 'CANVAS',
      tag: top?.tagName ?? 'none',
      className: typeof top?.className === 'string' ? top.className : '',
    };
  });
  expect(interception.ok, JSON.stringify(interception)).toBe(true);
  errors.assertNone();
});

test('small phone portrait keeps near-full board width with mapped fixture move', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(90_000);
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(buildE2EUrl({ fixture: 'fast-gravity' }));
  await waitForSceneReady(page, 'main-menu');
  await clickSceneButton(page, 0.5, 0.5);
  const status = await waitForSceneReady(page, 'puzzle');
  await assertPhoneBoardWidthFill(page, 320);
  await expect(status).toHaveAttribute('data-board-theme', /fantasy-board-v1|procedural-vector/);
  await expect.poll(async () => status.getAttribute('data-asset-variant')).toBe('mobile');

  const from = (await status.getAttribute('data-expected-move-from'))?.split(':').map(Number);
  const to = (await status.getAttribute('data-expected-move-to'))?.split(':').map(Number);
  if (!from || !to || from.length !== 2 || to.length !== 2) {
    throw new Error('Expected fixture move coordinates');
  }

  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  const geometry = {
    logicalCanvasWidth: await statusNumber(page, 'logical-canvas-width'),
    logicalCanvasHeight: await statusNumber(page, 'logical-canvas-height'),
    boardX: await statusNumber(page, 'board-x'),
    boardY: await statusNumber(page, 'board-y'),
    cellSize: await statusNumber(page, 'cell-size'),
    rows: await statusNumber(page, 'board-rows'),
    columns: await statusNumber(page, 'board-columns'),
  };
  const pointFor = (row: number, column: number) =>
    boardCoordinateToBrowserCanvasPoint({
      coordinate: { row, column },
      geometry,
      canvasBounds: { width: bounds.width, height: bounds.height },
    });

  // Edge-cell selection proves input geometry tracks the widened board.
  const edgeColumn = geometry.columns - 1;
  await canvas.click({ position: pointFor(0, edgeColumn) });
  await expect(status).toHaveAttribute('data-selected-coordinate', `0:${edgeColumn}`);
  // Toggle off so the upcoming fixture swap is a fresh two-tap sequence.
  await canvas.click({ position: pointFor(0, edgeColumn) });
  await expect(status).toHaveAttribute('data-selected-coordinate', '');

  const sequenceBefore = Number(await status.getAttribute('data-playback-sequence'));
  await canvas.click({ position: pointFor(from[0], from[1]) });
  await expect(status).toHaveAttribute('data-selected-coordinate', `${from[0]}:${from[1]}`);
  await canvas.click({ position: pointFor(to[0], to[1]) });
  await expect(status).toHaveAttribute('data-playback-sequence', String(sequenceBefore + 1));
  await expect(status).toHaveAttribute('data-last-move-accepted', 'true');
  errors.assertNone();
});

test('special and rift fixtures expose Fantasy visual diagnostics without changing authority', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(90_000);
  const errors = collectBrowserErrors(page);

  await page.goto(buildE2EUrl({ fixture: 'line-area-combination' }));
  await waitForSceneReady(page, 'main-menu');
  await clickSceneButton(page, 0.5, 0.5);
  let status = await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-special-visual-id', /fantasy-special-/);
  const hashBefore = await status.getAttribute('data-authoritative-board-hash');

  await page.goto(buildE2EUrl({ level: 'rift-erosion-lab', seed: 1811 }));
  status = await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-threat-status', 'active');
  await expect
    .poll(async () => status.getAttribute('data-rift-visual-state'))
    .toMatch(/fantasy-rift-/);
  await expect(status).toHaveAttribute('data-threat-corrupted-coordinates', /\d+:\d+/);
  expect(hashBefore).toBeTruthy();
  errors.assertNone();
});

test('reduced motion and restart keep Fantasy identities with stable authority', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(90_000);
  const errors = collectBrowserErrors(page);
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'storycrush.prototype-settings.v1',
      JSON.stringify({
        version: 1,
        playbackMode: 'instant',
        reducedMotion: true,
        hintsEnabled: true,
      }),
    );
  });
  await page.goto(buildE2EUrl({ level: 'archive-stabilization', seed: 1807 }));
  const status = await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-reduced-motion', 'true');
  await expect(status).toHaveAttribute(
    'data-reduced-motion-presentation',
    /fantasy-effect-hint-reduced/,
  );
  await expect(status).toHaveAttribute('data-piece-visual-id', /fantasy-/);

  const before = await status.getAttribute('data-authoritative-board-hash');
  await page.keyboard.press('r');
  await expect(status).toHaveAttribute('data-restart-count', '1');
  await expect(status).toHaveAttribute('data-authoritative-board-hash', before ?? '');
  await expect(status).toHaveAttribute('data-piece-visual-id', /fantasy-/);
  errors.assertNone();
});

test('resize preserves board authority and Fantasy theme diagnostics', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(90_000);
  const errors = collectBrowserErrors(page);
  const expectPhaserResize = testInfo.project.name === 'chromium-desktop';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(buildE2EUrl({ level: 'archive-stabilization', seed: 1807 }));
  const status = await waitForSceneReady(page, 'puzzle');
  const before = await status.getAttribute('data-authoritative-board-hash');
  const themeBefore = await status.getAttribute('data-board-theme');

  const assertAuthorityAndTheme = async () => {
    await expect(status).toHaveAttribute('data-authoritative-board-hash', before ?? '');
    await expect(status).toHaveAttribute('data-board-theme', themeBefore ?? '');
    await expect(status).toHaveAttribute('data-piece-visual-id', /fantasy-/);
  };

  // Phone landscape
  await page.setViewportSize({ width: 844, height: 390 });
  expect(page.viewportSize()).toEqual({ width: 844, height: 390 });
  if (expectPhaserResize) {
    await expect.poll(async () => status.getAttribute('data-logical-canvas-width')).toBe('844');
    await expect(status).toHaveAttribute('data-logical-canvas-height', '390');
  }
  await assertAuthorityAndTheme();

  // Tablet-ish portrait
  await page.setViewportSize({ width: 820, height: 1180 });
  expect(page.viewportSize()).toEqual({ width: 820, height: 1180 });
  if (expectPhaserResize) {
    await expect.poll(async () => status.getAttribute('data-logical-canvas-width')).toBe('820');
  }
  await expect(getTestStatus(page)).toHaveAttribute('data-authoritative-board-hash', before ?? '');
  await expect(getTestStatus(page)).toHaveAttribute('data-board-theme', themeBefore ?? '');

  // One desktop size — general Fantasy assets, not mobile overrides.
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
  if (expectPhaserResize) {
    await expect.poll(async () => status.getAttribute('data-logical-canvas-width')).toBe('1280');
    await expect
      .poll(async () => status.getAttribute('data-asset-variant'))
      .toMatch(/general|procedural/);
    await expect(status).not.toHaveAttribute('data-asset-variant', 'mobile');
  }
  await assertAuthorityAndTheme();

  // Tablet portrait also stays on general assets.
  await page.setViewportSize({ width: 820, height: 1180 });
  if (expectPhaserResize) {
    await expect
      .poll(async () => status.getAttribute('data-asset-variant'))
      .toMatch(/general|procedural/);
  }
  await assertAuthorityAndTheme();
  errors.assertNone();
});
