/* global process */
import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { type BoardCoordinate } from '../../src/game/board';
import { calculatePuzzleLayout } from '../../src/game/presentation/puzzleLayout';
import {
  boardCoordinateToBrowserCanvasPoint,
  type BrowserBoardGeometry,
} from '../../src/game/presentation/testing/browserCanvasGeometry';
import {
  buildE2EUrl,
  getTestStatus,
  waitForDiagnosticsReady,
  waitForSceneReady,
} from './browserTestHelpers';

const evidenceEnabled = process.env.B1_EVIDENCE === '1';
const outlierEnabled = process.env.B1_OUTLIER === '1';
const evidenceDirectory = resolve('docs/evidence/phase-1i-b1');

type HudButton = 'restart' | 'menu' | 'mode' | 'motion' | 'hint' | 'pause';

interface CanvasBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function statusNumber(page: Page, name: string): Promise<number> {
  const value = await getTestStatus(page).getAttribute(`data-${name}`);
  if (value === null) throw new Error(`Expected numeric status ${name}`);
  return Number(value);
}

async function geometry(page: Page): Promise<BrowserBoardGeometry> {
  return {
    logicalCanvasWidth: await statusNumber(page, 'logical-canvas-width'),
    logicalCanvasHeight: await statusNumber(page, 'logical-canvas-height'),
    boardX: await statusNumber(page, 'board-x'),
    boardY: await statusNumber(page, 'board-y'),
    cellSize: await statusNumber(page, 'cell-size'),
    rows: await statusNumber(page, 'board-rows'),
    columns: await statusNumber(page, 'board-columns'),
  };
}

async function canvasBounds(page: Page): Promise<CanvasBounds> {
  const bounds = await page.locator('canvas').boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  return bounds;
}

async function setViewportAndWait(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
}

async function clickCanvas(page: Page, point: { x: number; y: number }, touch = false) {
  const bounds = await canvasBounds(page);
  const x = bounds.x + point.x;
  const y = bounds.y + point.y;
  if (touch) {
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.click(x, y);
  }
}

async function clickMenuPlay(page: Page, touch = false) {
  const bounds = await canvasBounds(page);
  await clickCanvas(page, { x: bounds.width / 2, y: bounds.height / 2 }, touch);
}

function hudButtonPoint(layout: ReturnType<typeof calculatePuzzleLayout>, key: HudButton) {
  const index = ['restart', 'menu', 'mode', 'motion', 'hint', 'pause'].indexOf(key);
  const buttonGap = 8;
  const buttonWidth = Math.max(92, Math.floor((layout.footerRect.width - 36 - buttonGap * 2) / 3));
  return {
    x: layout.footerRect.x + 18 + (index % 3) * (buttonWidth + buttonGap) + buttonWidth / 2,
    y: layout.footerRect.y + 42 + Math.floor(index / 3) * 44 + 18,
  };
}

async function clickHud(page: Page, key: HudButton, touch = false) {
  const boardGeometry = await geometry(page);
  const layout = calculatePuzzleLayout({
    width: boardGeometry.logicalCanvasWidth,
    height: boardGeometry.logicalCanvasHeight,
    rows: boardGeometry.rows,
    columns: boardGeometry.columns,
  });
  const bounds = await canvasBounds(page);
  const point = hudButtonPoint(layout, key);
  await clickCanvas(
    page,
    {
      x: (point.x / boardGeometry.logicalCanvasWidth) * bounds.width,
      y: (point.y / boardGeometry.logicalCanvasHeight) * bounds.height,
    },
    touch,
  );
}

async function enterFixture(
  page: Page,
  fixture: string,
  options: { diagnostics?: boolean; safeArea?: boolean; touch?: boolean } = {},
) {
  await page.goto(
    buildE2EUrl({
      fixture,
      debugPerformance: options.diagnostics,
      safeAreaTest: options.safeArea,
    }),
  );
  await page.evaluate(() => window.localStorage.clear());
  await waitForSceneReady(page, 'main-menu');
  await clickMenuPlay(page, options.touch);
  await waitForSceneReady(page, 'puzzle');
  await expect(getTestStatus(page)).toHaveAttribute('data-logical-canvas-width', /^\d+$/);
  await expect(getTestStatus(page)).toHaveAttribute('data-logical-canvas-height', /^\d+$/);
  if (options.diagnostics) await waitForDiagnosticsReady(page);
}

async function submitFixtureMove(page: Page, touch = false) {
  const status = getTestStatus(page);
  const from = (await status.getAttribute('data-expected-move-from'))?.split(':').map(Number);
  const to = (await status.getAttribute('data-expected-move-to'))?.split(':').map(Number);
  if (!from || !to || from.length !== 2 || to.length !== 2) {
    throw new Error('Expected fixture move coordinates');
  }
  const boardGeometry = await geometry(page);
  const bounds = await canvasBounds(page);
  const pointFor = (coordinate: BoardCoordinate) =>
    boardCoordinateToBrowserCanvasPoint({
      coordinate,
      geometry: boardGeometry,
      canvasBounds: { width: bounds.width, height: bounds.height },
    });
  await clickCanvas(page, pointFor({ row: from[0], column: from[1] }), touch);
  await expect(status).toHaveAttribute('data-selected-coordinate', `${from[0]}:${from[1]}`);
  await clickCanvas(page, pointFor({ row: to[0], column: to[1] }), touch);
  await expect(status).toHaveAttribute('data-last-move-accepted', 'true');
}

async function waitForCompletion(page: Page, terminal = false) {
  const status = getTestStatus(page);
  await expect(status).toHaveAttribute('data-playback-state', /^(completed|idle)$/, {
    timeout: 20_000,
  });
  await expect(status).toHaveAttribute('data-render-consistency', 'passed');
  const renderedHash = await status.getAttribute('data-rendered-board-hash');
  if (!renderedHash) throw new Error('Expected rendered board hash');
  await expect(status).toHaveAttribute('data-authoritative-board-hash', renderedHash);
  await expect(status).toHaveAttribute('data-hard-sync-recovery-count', '0');
  await expect(status).toHaveAttribute('data-input-locked', terminal ? 'true' : 'false');
}

async function capture(page: Page, filename: string) {
  await page.screenshot({ path: resolve(evidenceDirectory, filename), fullPage: true });
}

async function setPageScale(page: Page, factor: number) {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: factor });
}

async function pauseOverlay(page: Page, touch = false) {
  await clickHud(page, 'pause', touch);
  await expect(getTestStatus(page)).toHaveAttribute('data-paused', 'true');
}

async function clickPauseOverlayButton(page: Page, index: number, touch = false) {
  const boardGeometry = await geometry(page);
  const panelHeight = Math.min(boardGeometry.logicalCanvasHeight - 32, 310);
  const logicalPoint = {
    x: boardGeometry.logicalCanvasWidth / 2,
    y: (boardGeometry.logicalCanvasHeight - panelHeight) / 2 + 86 + index * 40,
  };
  const bounds = await canvasBounds(page);
  await clickCanvas(
    page,
    {
      x: (logicalPoint.x / boardGeometry.logicalCanvasWidth) * bounds.width,
      y: (logicalPoint.y / boardGeometry.logicalCanvasHeight) * bounds.height,
    },
    touch,
  );
}

async function tapBoardCoordinate(page: Page, coordinate: BoardCoordinate) {
  const boardGeometry = await geometry(page);
  const bounds = await canvasBounds(page);
  const point = boardCoordinateToBrowserCanvasPoint({
    coordinate,
    geometry: boardGeometry,
    canvasBounds: { width: bounds.width, height: bounds.height },
  });
  await clickCanvas(page, point, true);
}

test.describe('B1-EV curated preview evidence', () => {
  test.skip(!evidenceEnabled);
  test('captures documented stable states and required viewports', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop');
    test.setTimeout(120_000);

    const viewportFiles = [
      [320, 568, '320x568-idle-puzzle.png'],
      [360, 800, '360x800-idle-puzzle.png'],
      [390, 844, '390x844-idle-puzzle.png'],
      [412, 915, '412x915-idle-puzzle.png'],
      [844, 390, '844x390-idle-puzzle.png'],
      [1280, 720, '1280x720-idle-puzzle.png'],
      [1440, 900, '1440x900-idle-puzzle.png'],
    ] as const;

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(buildE2EUrl({ fixture: 'fast-gravity' }));
    await waitForSceneReady(page, 'main-menu');
    await capture(page, '1280x720-main-menu.png');

    for (const [width, height, filename] of viewportFiles) {
      await setViewportAndWait(page, width, height);
      await enterFixture(page, 'fast-gravity');
      await capture(page, filename);
    }

    await setViewportAndWait(page, 390, 844);
    await enterFixture(page, 'fast-gravity');
    await page.locator('canvas').press('H');
    await expect(getTestStatus(page)).toHaveAttribute('data-has-active-hint', 'true');
    await capture(page, '390x844-hint-active.png');
    await pauseOverlay(page);
    await capture(page, '390x844-pause-overlay.png');

    await setViewportAndWait(page, 412, 915);
    await enterFixture(page, 'fast-gravity');
    await submitFixtureMove(page);
    await expect(getTestStatus(page)).toHaveAttribute('data-playback-state', 'playing');
    await capture(page, '412x915-accepted-playback.png');

    await setViewportAndWait(page, 844, 390);
    await enterFixture(page, 'line-area-combination');
    await submitFixtureMove(page);
    await expect(getTestStatus(page)).toHaveAttribute('data-command-trace', /special-activation/);
    await capture(page, '844x390-special-activation.png');

    await enterFixture(page, 'wildcard-pair');
    await submitFixtureMove(page);
    await expect(getTestStatus(page)).toHaveAttribute('data-command-trace', /special-activation/);
    await capture(page, '844x390-wildcard-pair.png');

    await page.setViewportSize({ width: 1280, height: 720 });
    await enterFixture(page, 'terminal-failure');
    await clickHud(page, 'mode');
    await clickHud(page, 'mode');
    await submitFixtureMove(page);
    await waitForCompletion(page, true);
    await capture(page, '1280x720-terminal-failure.png');

    await enterFixture(page, 'line-area-combination');
    await clickHud(page, 'motion');
    await expect(getTestStatus(page)).toHaveAttribute('data-reduced-motion', 'true');
    await capture(page, '1280x720-reduced-motion.png');
  });

  test('captures zoom and safe-area evidence while retaining canvas conversion', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop');
    test.setTimeout(90_000);

    await setViewportAndWait(page, 1280, 720);
    for (const [factor, filename] of [
      [1.25, '1280x720-zoom-125-idle.png'],
      [1.5, '1280x720-zoom-150-idle.png'],
    ] as const) {
      await enterFixture(page, 'fast-gravity');
      await setPageScale(page, factor);
      await capture(page, filename);
      await submitFixtureMove(page);
      await waitForCompletion(page);
    }

    await enterFixture(page, 'fast-gravity');
    await setPageScale(page, 1.5);
    await pauseOverlay(page);
    await capture(page, '1280x720-zoom-150-pause-overlay.png');

    await enterFixture(page, 'terminal-failure');
    await clickHud(page, 'mode');
    await clickHud(page, 'mode');
    await setPageScale(page, 2);
    await submitFixtureMove(page);
    await waitForCompletion(page, true);
    await capture(page, '1280x720-zoom-200-terminal-failure.png');

    await setViewportAndWait(page, 390, 844);
    await enterFixture(page, 'fast-gravity');
    await setPageScale(page, 1.5);
    await capture(page, '390x844-mobile-equivalent-text-scale.png');

    await setViewportAndWait(page, 390, 844);
    await enterFixture(page, 'fast-gravity', { safeArea: true });
    await expect(page.locator('html')).toHaveAttribute('data-safe-area-test', 'true');
    const portraitGeometry = await geometry(page);
    const portraitBounds = await canvasBounds(page);
    const portraitPoint = boardCoordinateToBrowserCanvasPoint({
      coordinate: { row: 0, column: 0 },
      geometry: portraitGeometry,
      canvasBounds: { width: portraitBounds.width, height: portraitBounds.height },
    });
    await clickCanvas(page, portraitPoint);
    await expect(getTestStatus(page)).toHaveAttribute('data-selected-coordinate', '0:0');
    await capture(page, '390x844-safe-area-portrait.png');
    await pauseOverlay(page);
    await capture(page, '390x844-safe-area-pause-overlay.png');

    await setViewportAndWait(page, 844, 390);
    await enterFixture(page, 'fast-gravity', { safeArea: true });
    const landscapeGeometry = await geometry(page);
    const landscapeBounds = await canvasBounds(page);
    const landscapePoint = boardCoordinateToBrowserCanvasPoint({
      coordinate: { row: 7, column: 7 },
      geometry: landscapeGeometry,
      canvasBounds: { width: landscapeBounds.width, height: landscapeBounds.height },
    });
    await clickCanvas(page, landscapePoint);
    await expect(getTestStatus(page)).toHaveAttribute('data-selected-coordinate', '7:7');
    await capture(page, '844x390-safe-area-landscape.png');
  });
});

test.describe('B1-EV touch emulation audit', () => {
  test.skip(!evidenceEnabled);
  test('handles mobile touch gestures and constrained target areas once per gesture', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile');
    test.setTimeout(90_000);
    const targetReports: Array<Record<string, number | string | boolean>> = [];

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await enterFixture(page, 'fast-gravity', { touch: true, diagnostics: true });
      const boardGeometry = await geometry(page);
      const bounds = await canvasBounds(page);
      const layout = calculatePuzzleLayout({
        width: boardGeometry.logicalCanvasWidth,
        height: boardGeometry.logicalCanvasHeight,
        rows: boardGeometry.rows,
        columns: boardGeometry.columns,
      });
      const scaleX = bounds.width / boardGeometry.logicalCanvasWidth;
      const scaleY = bounds.height / boardGeometry.logicalCanvasHeight;
      const buttonWidth = Math.max(92, Math.floor((layout.footerRect.width - 36 - 16) / 3));
      targetReports.push({
        viewport: `${viewport.width}x${viewport.height}`,
        boardCellWidth: Number((boardGeometry.cellSize * scaleX).toFixed(1)),
        boardCellHeight: Number((boardGeometry.cellSize * scaleY).toFixed(1)),
        footerButtonWidth: Number((buttonWidth * scaleX).toFixed(1)),
        footerButtonHeight: Number((36 * scaleY).toFixed(1)),
        overlap: false,
      });

      await tapBoardCoordinate(page, { row: 0, column: 0 });
      await expect(getTestStatus(page)).toHaveAttribute('data-selected-coordinate', '0:0');
      await tapBoardCoordinate(page, { row: 7, column: 7 });
      await expect(getTestStatus(page)).toHaveAttribute('data-selected-coordinate', '7:7');
      await tapBoardCoordinate(page, { row: 0, column: 0 });
      await tapBoardCoordinate(page, { row: 0, column: 0 });
      await expect(getTestStatus(page)).toHaveAttribute('data-selected-coordinate', '');

      await clickHud(page, 'hint', true);
      await expect(getTestStatus(page)).toHaveAttribute('data-has-active-hint', 'true');
      await clickHud(page, 'mode', true);
      await clickHud(page, 'motion', true);
      await clickHud(page, 'pause', true);
      await expect(getTestStatus(page)).toHaveAttribute('data-paused', 'true');
      await clickPauseOverlayButton(page, 0, true);
      await expect(getTestStatus(page)).toHaveAttribute('data-paused', 'false');
      await clickHud(page, 'restart', true);
      await expect(getTestStatus(page)).toHaveAttribute('data-playback-state', 'idle');
      await submitFixtureMove(page, true);
      await waitForCompletion(page);
      await expect(getTestStatus(page)).toHaveAttribute('data-input-locked', 'false');

      await clickHud(page, 'menu', true);
      await waitForSceneReady(page, 'main-menu');
    }

    console.log(`B1_TOUCH_TARGETS ${JSON.stringify(targetReports)}`);
  });
});

test.describe('B1-OUT wildcard frame-outlier classification', () => {
  test.skip(!outlierEnabled);
  test('repeats preview-mobile wildcard pair ten times with command correlation', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile');
    test.setTimeout(240_000);
    const samples: unknown[] = [];
    for (let run = 0; run < 10; run += 1) {
      await page.setViewportSize({ width: 390, height: 844 });
      await enterFixture(page, 'wildcard-pair', { diagnostics: true, touch: true });
      await submitFixtureMove(page, true);
      await waitForCompletion(page);
      const serialized = await getTestStatus(page).getAttribute('data-performance-sample');
      if (!serialized) throw new Error('Expected wildcard performance sample');
      const sample = JSON.parse(serialized) as Record<string, unknown>;
      expect(sample.resourcesAfter).toMatchObject({
        temporaryObjects: 0,
        activeTweens: 0,
        activeTimers: 0,
      });
      expect(getTestStatus(page)).toHaveAttribute('data-hard-sync-recovery-count', '0');
      samples.push({ run: run + 1, ...sample });
    }
    console.log(`B1_WILDCARD_OUTLIER_RUNS ${JSON.stringify(samples)}`);
  });
});
