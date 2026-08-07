/* global localStorage */
import { expect, test, type Page } from '@playwright/test';
import { boardCoordinateToBrowserCanvasPoint } from '../../src/game/presentation/testing/browserCanvasGeometry';
import {
  assertActiveSceneContentWithinWidth,
  assertViewportSynchronized,
  buildE2EUrl,
  buildNormalFlowUrl,
  clickPublishedAction,
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
    assertNone: () => {
      const unexpected = errors.filter((error) => !error.includes('drawImage'));
      expect(unexpected, unexpected.join('\n')).toEqual([]);
    },
  };
}

async function statusNumber(page: Page, name: string): Promise<number> {
  const value = await page.locator(statusSelector).getAttribute(`data-${name}`);
  if (value === null || Number.isNaN(Number(value))) {
    throw new Error(`Expected numeric data-${name}`);
  }
  return Number(value);
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
}

async function runShellToPuzzle(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.goto(buildNormalFlowUrl());
  await waitForSceneReady(page, 'main-menu');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.5 });
  await waitForSceneReady(page, 'multiverse-map');
  await clickPublishedAction(page, 'map-enter-ratio', { x: 0.5, y: 0.48 });
  await waitForSceneReady(page, 'chapter-intro');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.68 });
  await waitForSceneReady(page, 'dialogue');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.72 });
  await waitForSceneReady(page, 'story-choice');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.34 });
  await waitForSceneReady(page, 'puzzle');
}

async function playEdgeMappedMove(page: Page): Promise<void> {
  const status = getTestStatus(page);
  await page.keyboard.press('h');
  await expect.poll(async () => status.getAttribute('data-has-active-hint')).toBe('true');
  const from = (await status.getAttribute('data-hint-from'))?.split(':').map(Number);
  const to = (await status.getAttribute('data-hint-to'))?.split(':').map(Number);
  if (!from || !to || from.length !== 2 || to.length !== 2) {
    throw new Error('Expected hint coordinates');
  }
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected canvas bounds');
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
  const sequenceBefore = Number(await status.getAttribute('data-playback-sequence'));
  await canvas.click({ position: pointFor(from[0], from[1]) });
  await canvas.click({ position: pointFor(to[0], to[1]) });
  await expect(status).toHaveAttribute('data-playback-sequence', String(sequenceBefore + 1));
  await expect(status).toHaveAttribute('data-last-move-accepted', 'true');
}

test('390 phone keeps viewport truth through shell and near-full-width puzzle', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await runShellToPuzzle(page);

  await assertViewportSynchronized(page, 390);
  await assertNoHorizontalOverflow(page);
  await assertActiveSceneContentWithinWidth(page, 390);

  const boardWidth =
    (await statusNumber(page, 'cell-size')) * (await statusNumber(page, 'board-columns'));
  const logicalWidth = await statusNumber(page, 'logical-canvas-width');
  const boardX = await statusNumber(page, 'board-x');
  expect(logicalWidth).toBe(390);
  expect(boardWidth / logicalWidth).toBeGreaterThanOrEqual(0.94);
  expect(boardX).toBeLessThanOrEqual(12);
  expect(logicalWidth - boardX - boardWidth).toBeLessThanOrEqual(12);

  await playEdgeMappedMove(page);
  errors.assertNone();
});

test('320 phone keeps synchronized viewport and reachable pre-board content', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(buildNormalFlowUrl());

  await waitForSceneReady(page, 'main-menu');
  await assertViewportSynchronized(page, 320);
  await assertActiveSceneContentWithinWidth(page, 320);
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.5 });

  await waitForSceneReady(page, 'multiverse-map');
  await assertViewportSynchronized(page, 320);
  await assertActiveSceneContentWithinWidth(page, 320);
  await clickPublishedAction(page, 'map-enter-ratio', { x: 0.5, y: 0.45 });

  await waitForSceneReady(page, 'chapter-intro');
  await assertViewportSynchronized(page, 320);
  await assertActiveSceneContentWithinWidth(page, 320);
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.68 });

  await waitForSceneReady(page, 'dialogue');
  await assertViewportSynchronized(page, 320);
  await assertActiveSceneContentWithinWidth(page, 320);
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.72 });

  await waitForSceneReady(page, 'story-choice');
  await assertViewportSynchronized(page, 320);
  await assertActiveSceneContentWithinWidth(page, 320);
  await assertNoHorizontalOverflow(page);
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.4 });

  await waitForSceneReady(page, 'puzzle');
  await assertViewportSynchronized(page, 320);
  const boardWidth =
    (await statusNumber(page, 'cell-size')) * (await statusNumber(page, 'board-columns'));
  expect(boardWidth / (await statusNumber(page, 'logical-canvas-width'))).toBeGreaterThanOrEqual(
    0.94,
  );
  errors.assertNone();
});

test('results and consequence stay inside phone safe bounds', async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem(
      'storycrush.prototype-settings.v1',
      JSON.stringify({
        version: 1,
        playbackMode: 'instant',
        reducedMotion: false,
        hintsEnabled: true,
      }),
    );
  });
  await page.goto(buildE2EUrl({ fixture: 'terminal-failure' }));
  await waitForSceneReady(page, 'main-menu');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.5 });
  await waitForSceneReady(page, 'multiverse-map');
  await clickPublishedAction(page, 'map-enter-ratio', { x: 0.28, y: 0.56 });
  await waitForSceneReady(page, 'chapter-intro');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.68 });
  await waitForSceneReady(page, 'dialogue');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.72 });
  await waitForSceneReady(page, 'story-choice');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.34 });
  await waitForSceneReady(page, 'puzzle');

  // Use expected fixture move from status bridge.
  const status = getTestStatus(page);
  const from = (await status.getAttribute('data-expected-move-from'))?.split(':').map(Number);
  const to = (await status.getAttribute('data-expected-move-to'))?.split(':').map(Number);
  if (!from || !to) throw new Error('Expected fixture move');
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('canvas');
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
  await canvas.click({ position: pointFor(from[0], from[1]) });
  await canvas.click({ position: pointFor(to[0], to[1]) });

  await waitForSceneReady(page, 'results');
  await assertViewportSynchronized(page, 390);
  await assertActiveSceneContentWithinWidth(page, 390);
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.72 });

  await waitForSceneReady(page, 'consequence');
  await assertViewportSynchronized(page, 390);
  await assertActiveSceneContentWithinWidth(page, 390);
  await assertNoHorizontalOverflow(page);
  errors.assertNone();
});

test('phone landscape and tablet keep synchronized scale', async ({ page }, testInfo) => {
  testInfo.setTimeout(90_000);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(buildNormalFlowUrl());
  await waitForSceneReady(page, 'main-menu');
  await assertViewportSynchronized(page, 844);
  await expect(getTestStatus(page)).toHaveAttribute('data-layout-class', 'phone-landscape');

  await page.setViewportSize({ width: 820, height: 1180 });
  await expect
    .poll(async () => getTestStatus(page).getAttribute('data-phaser-scale-width'))
    .toBe('820');
  await assertViewportSynchronized(page, 820);
  await expect(getTestStatus(page)).toHaveAttribute('data-layout-class', 'tablet');

  // Restore a phone portrait size so later suite tests do not inherit tablet geometry.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => getTestStatus(page).getAttribute('data-phaser-scale-width'))
    .toBe('390');
});

test('desktop neighboring path keeps synchronized scale', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(buildNormalFlowUrl());
  await waitForSceneReady(page, 'main-menu');
  await assertViewportSynchronized(page, 1280);
  await expect(getTestStatus(page)).toHaveAttribute('data-layout-class', 'desktop');
});

test('viewportDebug overlay appears only with the query flag', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2e=1');
  await waitForSceneReady(page, 'main-menu');
  await expect(page.locator('#storycrush-viewport-debug')).toHaveCount(0);

  await page.goto('/?e2e=1&viewportDebug=1');
  await waitForSceneReady(page, 'main-menu');
  await expect(page.locator('#storycrush-viewport-debug')).toContainText('phaser');
  await expect(page.locator('#storycrush-viewport-debug')).toContainText('layout-class');
});
