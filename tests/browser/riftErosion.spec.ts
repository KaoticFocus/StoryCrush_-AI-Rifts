import { expect, test, type Page } from '@playwright/test';
import { buildE2EUrl, getTestStatus, waitForSceneReady } from './browserTestHelpers';

function collectBrowserErrors(page: Page): { assertNone(): void } {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return { assertNone: () => expect(errors).toEqual([]) };
}

async function clickSceneCenter(page: Page): Promise<void> {
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
}

async function pieceCenterOnCanvas(
  page: Page,
  coordinate: readonly [number, number],
): Promise<{ x: number; y: number }> {
  const status = getTestStatus(page);
  const numberAttribute = async (name: string) => Number(await status.getAttribute(`data-${name}`));
  const logicalWidth = await numberAttribute('logical-canvas-width');
  const logicalHeight = await numberAttribute('logical-canvas-height');
  const boardX = await numberAttribute('board-x');
  const boardY = await numberAttribute('board-y');
  const cellSize = await numberAttribute('cell-size');
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  const [row, column] = coordinate;
  return {
    x: ((boardX + column * cellSize + cellSize / 2) / logicalWidth) * bounds.width,
    y: ((boardY + row * cellSize + cellSize / 2) / logicalHeight) * bounds.height,
  };
}

async function submitExpectedMove(
  page: Page,
  options: { allowCompletedPlayback?: boolean } = {},
): Promise<void> {
  const status = getTestStatus(page);
  const from = (await status.getAttribute('data-expected-move-from'))?.split(':').map(Number);
  const to = (await status.getAttribute('data-expected-move-to'))?.split(':').map(Number);
  if (!from || !to || from.length !== 2 || to.length !== 2) {
    throw new Error('Expected move coordinates missing from browser status');
  }
  const canvas = page.locator('canvas');
  const fromPoint = await pieceCenterOnCanvas(page, from as [number, number]);
  await canvas.click({ position: { x: fromPoint.x, y: fromPoint.y } });
  await expect(status).toHaveAttribute('data-selected-coordinate', `${from[0]}:${from[1]}`);
  const toPoint = await pieceCenterOnCanvas(page, to as [number, number]);
  await canvas.click({ position: { x: toPoint.x, y: toPoint.y } });
  await expect(status).toHaveAttribute('data-last-move-accepted', 'true');
  await expect(status).toHaveAttribute(
    'data-playback-state',
    options.allowCompletedPlayback ? /^(idle|completed)$/ : 'idle',
  );
}

async function enableInstantPlayback(page: Page): Promise<void> {
  await page.addInitScript(() =>
    window.localStorage.setItem(
      'storycrush.prototype-settings.v1',
      JSON.stringify({
        version: 1,
        playbackMode: 'instant',
        reducedMotion: true,
        hintsEnabled: true,
      }),
    ),
  );
}

test('Rift Erosion Lab launches with initial threat HUD fields', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  await clickSceneCenter(page);
  await waitForSceneReady(page, 'puzzle-lab');
  await expect(page.getByRole('button', { name: /^Play / })).toHaveCount(4);
  await page.getByRole('button', { name: /^Play Rift Erosion Lab/ }).click();
  const status = await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-level-id', 'rift-erosion-lab');
  await expect(status).toHaveAttribute('data-threat-status', 'active');
  await expect(status).toHaveAttribute('data-threat-hunger-current', '0');
  await expect(status).toHaveAttribute('data-threat-hunger-maximum', '5');
  await expect(status).toHaveAttribute('data-threat-moves-until-spread', '3');
  await expect(status).toHaveAttribute('data-threat-corrupted-coordinates', /0:0/);
  await expect(status).toHaveAttribute('data-threat-threatened-coordinate', /^\d+:\d+$/);
  errors.assertNone();
});

test('corrupted source tap is blocked without consuming a move', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await enableInstantPlayback(page);
  await page.goto(buildE2EUrl({ level: 'rift-erosion-lab', seed: 1810 }));
  const status = await waitForSceneReady(page, 'puzzle');
  const countdown = await status.getAttribute('data-threat-moves-until-spread');
  const moves = await status.getAttribute('data-moves-remaining');
  const point = await pieceCenterOnCanvas(page, [0, 0]);
  await page.locator('canvas').click({ position: { x: point.x, y: point.y } });
  await expect(status).toHaveAttribute('data-selected-coordinate', '');
  await expect(status).toHaveAttribute('data-threat-moves-until-spread', countdown!);
  await expect(status).toHaveAttribute('data-moves-remaining', moves!);
  await expect(status).toHaveAttribute('data-last-move-accepted', 'false');
  await expect(page.locator('#storycrush-status')).toContainText(/corrupted/i);

  const rejected = await page.evaluate(() => {
    const scene = window.__storyCrushGame?.scene.getScene('PuzzleScene') as {
      controller?: {
        requestSwap: (
          from: { row: number; column: number },
          to: { row: number; column: number },
        ) => { accepted: boolean; reason?: string };
      };
    };
    const result = scene.controller?.requestSwap({ row: 0, column: 0 }, { row: 0, column: 1 });
    return result ?? { accepted: false, reason: 'missing-controller' };
  });
  expect(rejected.accepted).toBe(false);
  expect(rejected.reason).toBe('cell-unavailable');
  errors.assertNone();
});

test('rift-spread fixture advances hunger on the accepted move', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await enableInstantPlayback(page);
  await page.goto(buildE2EUrl({ fixture: 'rift-spread' }));
  await waitForSceneReady(page, 'main-menu');
  await clickSceneCenter(page);
  const status = await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-threat-status', 'active');
  await expect(status).toHaveAttribute('data-threat-moves-until-spread', '1');
  await submitExpectedMove(page);
  await expect(getTestStatus(page)).toHaveAttribute('data-threat-hunger-current', '1');
  await expect(getTestStatus(page)).toHaveAttribute('data-command-trace', /rift-spread/);
  errors.assertNone();
});

test('rift-cleanse fixture removes adjacent non-source corruption', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await enableInstantPlayback(page);
  await page.goto(buildE2EUrl({ fixture: 'rift-cleanse' }));
  await waitForSceneReady(page, 'main-menu');
  await clickSceneCenter(page);
  const status = await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-threat-corrupted-coordinates', /1:0/);
  await expect(status).toHaveAttribute('data-threat-hunger-current', '0');
  const scoreBefore = await status.getAttribute('data-score');
  await submitExpectedMove(page);
  await expect(getTestStatus(page)).toHaveAttribute('data-command-trace', /rift-cleanse/);
  await expect(getTestStatus(page)).toHaveAttribute('data-threat-corrupted-coordinates', '7:0');
  await expect(getTestStatus(page)).toHaveAttribute('data-threat-hunger-current', '0');
  await expect(getTestStatus(page)).not.toHaveAttribute('data-score', scoreBefore ?? '');
  errors.assertNone();
});

test('rift-overwhelm fixture labels Rift Overwhelmed and locks input', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await enableInstantPlayback(page);
  await page.goto(buildE2EUrl({ fixture: 'rift-overwhelm' }));
  await waitForSceneReady(page, 'main-menu');
  await clickSceneCenter(page);
  await waitForSceneReady(page, 'puzzle');
  await submitExpectedMove(page, { allowCompletedPlayback: true });
  await expect(getTestStatus(page)).toHaveAttribute('data-scene', 'puzzle');
  await expect(getTestStatus(page)).toHaveAttribute('data-threat-status', 'overwhelmed');
  await expect(getTestStatus(page)).toHaveAttribute('data-level-status', 'failed');
  await expect(getTestStatus(page)).toHaveAttribute('data-input-locked', 'true');
  await expect(page.locator('#storycrush-status')).toContainText(/Rift overwhelmed/i);
  errors.assertNone();
});

test('third accepted lab move spreads on the warned cadence', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = collectBrowserErrors(page);
  await enableInstantPlayback(page);
  await page.goto(buildE2EUrl({ level: 'rift-erosion-lab', seed: 1810 }));
  const status = await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-threat-moves-until-spread', '3');
  await expect(status).toHaveAttribute('data-threat-hunger-current', '0');
  const threatened = await status.getAttribute('data-threat-threatened-coordinate');
  expect(threatened).toMatch(/^\d+:\d+$/);

  await submitExpectedMove(page);
  await expect(getTestStatus(page)).toHaveAttribute('data-threat-moves-until-spread', '2');
  await expect(getTestStatus(page)).toHaveAttribute('data-threat-hunger-current', '0');

  await submitExpectedMove(page);
  await expect(getTestStatus(page)).toHaveAttribute('data-threat-moves-until-spread', '1');
  await expect(getTestStatus(page)).toHaveAttribute('data-threat-hunger-current', '0');

  await submitExpectedMove(page);
  await expect(getTestStatus(page)).toHaveAttribute('data-threat-hunger-current', '1');
  await expect(getTestStatus(page)).toHaveAttribute(
    'data-threat-corrupted-coordinates',
    new RegExp(threatened!.replace(':', '\\:')),
  );
  await expect(getTestStatus(page)).toHaveAttribute('data-command-trace', /rift-spread/);
  errors.assertNone();
});

test('Rift Lab restart restores threat and New Board resets threat state', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = collectBrowserErrors(page);
  await enableInstantPlayback(page);
  await page.goto(buildE2EUrl({ level: 'rift-erosion-lab', seed: 1810 }));
  const status = await waitForSceneReady(page, 'puzzle');
  const seed = await status.getAttribute('data-seed');
  const initialHash = await status.getAttribute('data-initial-board-hash');
  const initialThreat = await status.getAttribute('data-threat-corrupted-coordinates');
  await submitExpectedMove(page);
  await expect(status).toHaveAttribute('data-last-move-accepted', 'true');

  await page.keyboard.press('r');
  await expect(status).toHaveAttribute('data-restart-count', '1');
  await expect(status).toHaveAttribute('data-seed', seed!);
  await expect(status).toHaveAttribute('data-current-board-hash', initialHash!);
  await expect(status).toHaveAttribute('data-threat-status', 'active');
  await expect(status).toHaveAttribute('data-threat-hunger-current', '0');
  await expect(status).toHaveAttribute('data-threat-moves-until-spread', '3');
  await expect(status).toHaveAttribute('data-threat-corrupted-coordinates', initialThreat!);

  await page.keyboard.press('b');
  await expect(status).toHaveAttribute('data-new-board-count', '1');
  await expect(status).toHaveAttribute('data-level-id', 'rift-erosion-lab');
  await expect(status).toHaveAttribute('data-seed', '1811');
  await expect(status).not.toHaveAttribute('data-initial-board-hash', initialHash!);
  await expect(status).toHaveAttribute('data-threat-status', 'active');
  await expect(status).toHaveAttribute('data-threat-hunger-current', '0');
  await expect(status).toHaveAttribute('data-threat-moves-until-spread', '3');
  errors.assertNone();
});

test('Rift Lab remains usable across required mobile-first viewports', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectBrowserErrors(page);
  const viewports = [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1024, height: 1366 },
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ] as const;

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(buildE2EUrl());
    await waitForSceneReady(page, 'main-menu');
    await clickSceneCenter(page);
    await waitForSceneReady(page, 'puzzle-lab');
    await expect(page.getByRole('button', { name: /^Play / })).toHaveCount(4);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);

    await page.getByRole('button', { name: /^Play Rift Erosion Lab/ }).click();
    const status = await waitForSceneReady(page, 'puzzle');
    await expect(status).toHaveAttribute('data-threat-status', 'active');
    await expect(status).toHaveAttribute('data-threat-hunger-maximum', '5');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    await page.keyboard.press('m');
    await waitForSceneReady(page, 'main-menu');
  }
  errors.assertNone();
});
