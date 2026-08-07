import { expect, test, type Page } from '@playwright/test';
import { boardCoordinateToBrowserCanvasPoint } from '../../src/game/presentation/testing/browserCanvasGeometry';
import {
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

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
}

async function statusNumber(page: Page, name: string): Promise<number> {
  const value = await page.locator(statusSelector).getAttribute(`data-${name}`);
  if (value === null || Number.isNaN(Number(value))) {
    throw new Error(`Expected numeric data-${name}`);
  }
  return Number(value);
}

async function playHintedMove(page: Page): Promise<void> {
  const status = getTestStatus(page);
  await page.keyboard.press('h');
  await expect.poll(async () => status.getAttribute('data-has-active-hint')).toBe('true');
  const from = (await status.getAttribute('data-hint-from'))?.split(':').map(Number);
  const to = (await status.getAttribute('data-hint-to'))?.split(':').map(Number);
  if (!from || !to || from.length !== 2 || to.length !== 2) {
    throw new Error('Expected hint coordinates after pressing H');
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
  await expect(status).toHaveAttribute('data-selected-coordinate', `${from[0]}:${from[1]}`);
  await canvas.click({ position: pointFor(to[0], to[1]) });
  await expect(status).toHaveAttribute('data-playback-sequence', String(sequenceBefore + 1));
  await expect(status).toHaveAttribute('data-last-move-accepted', 'true');
}

async function runNormalFlowToPuzzle(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.goto(buildNormalFlowUrl());
  await waitForSceneReady(page, 'main-menu');
  await expect(getTestStatus(page)).toHaveAttribute('data-layout-class', /.+/);
  await assertNoHorizontalOverflow(page);

  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.5 });
  await waitForSceneReady(page, 'multiverse-map');
  await expect(getTestStatus(page)).toHaveAttribute('data-layout-class', /.+/);
  await assertNoHorizontalOverflow(page);

  await clickPublishedAction(page, 'map-enter-ratio', { x: 0.5, y: 0.48 });
  await waitForSceneReady(page, 'chapter-intro');
  await assertNoHorizontalOverflow(page);

  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.68 });
  await waitForSceneReady(page, 'dialogue');
  await assertNoHorizontalOverflow(page);

  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.72 });
  await waitForSceneReady(page, 'story-choice');
  await assertNoHorizontalOverflow(page);

  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.34 });
  await waitForSceneReady(page, 'puzzle');
}

test('390 phone portrait normal flow reaches puzzle and accepts a move', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await runNormalFlowToPuzzle(page);

  const status = getTestStatus(page);
  await expect(status).toHaveAttribute('data-layout-class', 'phone-portrait');
  await expect.poll(async () => status.getAttribute('data-asset-variant')).toBe('mobile');
  const boardWidth =
    (await statusNumber(page, 'cell-size')) * (await statusNumber(page, 'board-columns'));
  const logicalWidth = await statusNumber(page, 'logical-canvas-width');
  expect(boardWidth / logicalWidth).toBeGreaterThanOrEqual(0.94);
  await assertNoHorizontalOverflow(page);
  await playHintedMove(page);
  errors.assertNone();
});

test('320 small phone keeps pre-board actions reachable without horizontal overflow', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.goto(buildNormalFlowUrl());

  await waitForSceneReady(page, 'main-menu');
  await expect(getTestStatus(page)).toHaveAttribute('data-layout-class', 'phone-portrait');
  await assertNoHorizontalOverflow(page);
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.5 });

  await waitForSceneReady(page, 'multiverse-map');
  await assertNoHorizontalOverflow(page);
  await clickPublishedAction(page, 'map-enter-ratio', { x: 0.5, y: 0.45 });

  await waitForSceneReady(page, 'chapter-intro');
  await assertNoHorizontalOverflow(page);
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.68 });

  await waitForSceneReady(page, 'dialogue');
  await assertNoHorizontalOverflow(page);
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.72 });

  await waitForSceneReady(page, 'story-choice');
  await assertNoHorizontalOverflow(page);
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.4 });

  await waitForSceneReady(page, 'puzzle');
  await expect(getTestStatus(page)).toHaveAttribute('data-asset-variant', 'mobile');
  errors.assertNone();
});

test('phone landscape normal flow remains navigable to the board', async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await runNormalFlowToPuzzle(page);
  await expect(getTestStatus(page)).toHaveAttribute('data-layout-class', 'phone-landscape');
  await expect
    .poll(async () => getTestStatus(page).getAttribute('data-asset-variant'))
    .toBe('mobile');
  await assertNoHorizontalOverflow(page);
  errors.assertNone();
});

test('desktop neighboring path still reaches the board', async ({ page }, testInfo) => {
  testInfo.setTimeout(120_000);
  test.skip(testInfo.project.name !== 'chromium-desktop');
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await runNormalFlowToPuzzle(page);
  await expect(getTestStatus(page)).toHaveAttribute('data-layout-class', 'desktop');
  await expect
    .poll(async () => getTestStatus(page).getAttribute('data-asset-variant'))
    .toMatch(/general|procedural/);
  errors.assertNone();
});
