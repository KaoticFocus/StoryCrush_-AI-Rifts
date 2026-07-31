import { expect, test, type Page } from '@playwright/test';
import { type BoardCoordinate } from '../../src/game/board';
import { type BrowserBoardGeometry } from '../../src/game/presentation/testing/browserCanvasGeometry';
import {
  buildE2EUrl,
  getTestStatus,
  statusSelector,
  waitForSceneReady,
} from './browserTestHelpers';

async function clickCanvasPoint(page: Page, point: { x: number; y: number }) {
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  await page.mouse.click(bounds.x + point.x, bounds.y + point.y);
}

async function clickSceneButton(page: Page, xRatio: number, yRatio: number) {
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  await clickCanvasPoint(page, { x: bounds.width * xRatio, y: bounds.height * yRatio });
}

async function getBoardGeometry(page: Page): Promise<BrowserBoardGeometry> {
  const getStatusNumber = async (name: string): Promise<number> => {
    const value = await page.locator(statusSelector).getAttribute(`data-${name}`);
    if (value === null) throw new Error(`Expected status data-${name}`);
    return Number(value);
  };

  return {
    logicalCanvasWidth: await getStatusNumber('logical-canvas-width'),
    logicalCanvasHeight: await getStatusNumber('logical-canvas-height'),
    boardX: await getStatusNumber('board-x'),
    boardY: await getStatusNumber('board-y'),
    cellSize: await getStatusNumber('cell-size'),
    rows: await getStatusNumber('board-rows'),
    columns: await getStatusNumber('board-columns'),
  };
}

async function submitExpectedFixtureMove(page: Page) {
  const status = page.locator(statusSelector);
  const from = (await status.getAttribute('data-expected-move-from'))?.split(':').map(Number);
  const to = (await status.getAttribute('data-expected-move-to'))?.split(':').map(Number);
  if (!from || !to || from.length !== 2 || to.length !== 2) {
    throw new Error('Expected fixture move coordinates in status bridge');
  }

  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  const geometry = await getBoardGeometry(page);
  const pointFor = (coordinate: BoardCoordinate) => {
    const point = {
      x:
        ((geometry.boardX + geometry.cellSize * coordinate.column + geometry.cellSize / 2) /
          geometry.logicalCanvasWidth) *
        bounds.width,
      y:
        ((geometry.boardY + geometry.cellSize * coordinate.row + geometry.cellSize / 2) /
          geometry.logicalCanvasHeight) *
        bounds.height,
    };
    return point;
  };

  await clickCanvasPoint(page, pointFor({ row: from[0], column: from[1] }));
  await clickCanvasPoint(page, pointFor({ row: to[0], column: to[1] }));
}

test('restores a saved fantasy chapter state from browser storage', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      'storycrush.game-flow',
      JSON.stringify({
        schemaVersion: 2,
        savedAtEpochMs: 42,
        state: {
          currentNodeId: 'results',
          storyFlags: ['FANTASY_ARCHIVE_STABILIZED'],
          chapterStatus: {
            'fantasy-chapter': {
              status: 'completed',
              lastOutcome: 'won',
            },
          },
          latestPuzzleResult: {
            outcome: 'won',
            score: 1200,
            movesRemaining: 7,
            objectiveCompleted: true,
          },
          hasContinuableSession: true,
        },
      }),
    );
  });

  await page.goto(buildE2EUrl());

  await waitForSceneReady(page, 'main-menu');
  await clickSceneButton(page, 0.5, 0.7);
  await waitForSceneReady(page, 'results');
});

test('plays the fantasy chapter shell flow through results and consequence scenes', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
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
  await clickSceneButton(page, 0.5, 0.6);
  await waitForSceneReady(page, 'multiverse-map');
  await clickSceneButton(page, 0.28, 0.56);
  await waitForSceneReady(page, 'chapter-intro');
  await clickSceneButton(page, 0.5, 0.68);
  await waitForSceneReady(page, 'dialogue');
  await clickSceneButton(page, 0.5, 0.72);
  await waitForSceneReady(page, 'story-choice');
  await clickSceneButton(page, 0.5, 0.34);
  await waitForSceneReady(page, 'puzzle');
  await expect(getTestStatus(page)).toHaveAttribute('data-playback-mode', 'instant');
  await submitExpectedFixtureMove(page);

  await waitForSceneReady(page, 'results');
  await clickSceneButton(page, 0.5, 0.72);
  await expect(getTestStatus(page)).toHaveAttribute('data-scene', 'consequence');
  await clickSceneButton(page, 0.5, 0.68);
  await waitForSceneReady(page, 'multiverse-map');
});
