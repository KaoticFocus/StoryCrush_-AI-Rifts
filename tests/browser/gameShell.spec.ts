import { expect, test, type Page } from '@playwright/test';
import { type BoardCoordinate } from '../../src/game/board';
import { type BrowserBoardGeometry } from '../../src/game/presentation/testing/browserCanvasGeometry';
import {
  buildE2EUrl,
  clickPublishedAction,
  clickSceneRatio,
  getTestStatus,
  statusSelector,
  waitForSceneReady,
} from './browserTestHelpers';

async function clickCanvasPoint(page: Page, point: { x: number; y: number }) {
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  await canvas.click({ position: { x: point.x, y: point.y } });
}

async function clickSceneButton(page: Page, xRatio: number, yRatio: number) {
  await clickSceneRatio(page, xRatio, yRatio);
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
  await clickPublishedAction(page, 'continue-action-ratio', { x: 0.5, y: 0.68 });
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
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.6 });
  await waitForSceneReady(page, 'multiverse-map');
  await clickPublishedAction(page, 'map-enter-ratio', { x: 0.28, y: 0.56 });
  await waitForSceneReady(page, 'chapter-intro');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.68 });
  await waitForSceneReady(page, 'dialogue');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.72 });
  await waitForSceneReady(page, 'story-choice');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.34 });
  await waitForSceneReady(page, 'puzzle');
  await expect(getTestStatus(page)).toHaveAttribute('data-playback-mode', 'instant');
  await submitExpectedFixtureMove(page);

  await waitForSceneReady(page, 'results');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.72 });
  await expect(getTestStatus(page)).toHaveAttribute('data-scene', 'consequence');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.68 });
  await waitForSceneReady(page, 'multiverse-map');
});

test('second fantasy chapter pass accepts a new story choice after the first terminal loop', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });

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
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.6 });
  await waitForSceneReady(page, 'multiverse-map');
  await clickPublishedAction(page, 'map-enter-ratio', { x: 0.28, y: 0.56 });
  await waitForSceneReady(page, 'chapter-intro');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.68 });
  await waitForSceneReady(page, 'dialogue');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.72 });
  await waitForSceneReady(page, 'story-choice');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.34 });
  await waitForSceneReady(page, 'puzzle');
  await submitExpectedFixtureMove(page);
  await waitForSceneReady(page, 'results');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.72 });
  await waitForSceneReady(page, 'consequence');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.68 });
  await waitForSceneReady(page, 'multiverse-map');

  // Second pass: re-enter Fantasy and prove the choice advances into a new puzzle run.
  await clickPublishedAction(page, 'map-enter-ratio', { x: 0.28, y: 0.56 });
  await waitForSceneReady(page, 'chapter-intro');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.68 });
  await waitForSceneReady(page, 'dialogue');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.72 });
  await waitForSceneReady(page, 'story-choice');
  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.34 });
  await waitForSceneReady(page, 'puzzle');

  const movesBefore = Number(await getTestStatus(page).getAttribute('data-moves-remaining'));
  expect(Number.isFinite(movesBefore)).toBe(true);
  await submitExpectedFixtureMove(page);
  await waitForSceneReady(page, 'results');
  expect(pageErrors).toEqual([]);
});

test('cancels and confirms future-save replacement without losing the old payload', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const futurePayload = JSON.stringify({
    schemaVersion: 999,
    state: { currentNodeId: 'main-menu' },
  });
  await page.addInitScript((payload) => {
    if (window.sessionStorage.getItem('future-save-fixture-installed') === 'true') {
      return;
    }
    window.sessionStorage.setItem('future-save-fixture-installed', 'true');
    window.localStorage.clear();
    window.localStorage.setItem('storycrush.game-flow', payload);
  }, futurePayload);
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');

  await clickPublishedAction(page, 'primary-action-ratio', { x: 0.5, y: 0.6 });
  await expect(getTestStatus(page)).toHaveAttribute('data-confirmation-visible', 'true');
  await page.keyboard.press('Escape');
  await expect(getTestStatus(page)).toHaveAttribute('data-confirmation-visible', 'false');
  expect(await page.evaluate(() => window.localStorage.getItem('storycrush.game-flow'))).toBe(
    futurePayload,
  );

  await page.keyboard.press('n');
  await expect(getTestStatus(page)).toHaveAttribute('data-confirmation-visible', 'true');
  await page.keyboard.press('Enter');
  await waitForSceneReady(page, 'multiverse-map');
  const replacement = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('storycrush.game-flow') ?? 'null'),
  );
  expect(replacement).toMatchObject({
    schemaVersion: 3,
    state: {
      currentNodeId: 'multiverse-map',
      storyFlags: [],
    },
  });
  expect(replacement.state).not.toHaveProperty('latestPuzzleResult');

  await page.reload();
  await waitForSceneReady(page, 'main-menu');
  await page.keyboard.press('c');
  await waitForSceneReady(page, 'multiverse-map');
});

test('resumes an interrupted campaign puzzle as campaign play', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      'storycrush.game-flow',
      JSON.stringify({
        schemaVersion: 2,
        savedAtEpochMs: 42,
        state: {
          currentNodeId: 'puzzle',
          storyFlags: ['FANTASY_ARCHIVE_STABILIZED'],
          chapterStatus: { 'fantasy-chapter': { status: 'in-progress' } },
          hasContinuableSession: true,
        },
      }),
    );
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
  await page.keyboard.press('c');
  await waitForSceneReady(page, 'puzzle');
  await submitExpectedFixtureMove(page);
  await waitForSceneReady(page, 'results');

  const savedState = await page.evaluate(
    () => JSON.parse(window.localStorage.getItem('storycrush.game-flow') ?? 'null').state,
  );
  expect(savedState.currentNodeId).toBe('results');
  expect(savedState.latestPuzzleResult).toBeTruthy();
});

test('Puzzle Lab remains interactive after a fixture terminal return-to-menu loop', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

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

  // First pass: e2e fixture path (Menu Puzzle control) to a legitimate terminal lock.
  await page.goto(buildE2EUrl({ fixture: 'terminal-failure' }));
  await waitForSceneReady(page, 'main-menu');
  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle');
  await submitExpectedFixtureMove(page);
  await expect(getTestStatus(page)).toHaveAttribute('data-input-locked', 'true');
  await page.keyboard.press('m');
  await waitForSceneReady(page, 'main-menu');

  // Second pass: normal Puzzle Lab entry (no fixture short-circuit) and a real accepted move.
  await page.evaluate(() => {
    const url = new window.URL(window.location.href);
    url.searchParams.delete('fixture');
    url.searchParams.delete('scenario');
    window.history.replaceState({}, '', url.toString());
  });
  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle-lab');
  await page.getByRole('button', { name: 'Play Archive Stabilization' }).click();
  await waitForSceneReady(page, 'puzzle');
  await expect(getTestStatus(page)).toHaveAttribute('data-input-locked', 'false');
  const movesBefore = await getTestStatus(page).getAttribute('data-moves-remaining');
  await submitExpectedFixtureMove(page);
  await expect(getTestStatus(page)).not.toHaveAttribute('data-moves-remaining', movesBefore ?? '');
  expect(pageErrors).toEqual([]);
});

test('keeps Puzzle Lab isolated from campaign persistence', async ({ page }) => {
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
            'fantasy-chapter': { status: 'completed', lastOutcome: 'won' },
          },
          latestPuzzleResult: { outcome: 'won', score: 1200, movesRemaining: 7 },
          hasContinuableSession: true,
        },
      }),
    );
  });
  await page.goto(buildE2EUrl({ fixture: 'instant-resolution' }));
  await waitForSceneReady(page, 'main-menu');
  const originalPayload = await page.evaluate(() =>
    window.localStorage.getItem('storycrush.game-flow'),
  );

  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle');
  await submitExpectedFixtureMove(page);
  // Prefer keyboard return — the floating Back chip is desktop-only now so phone
  // portrait does not overflow, while Puzzle Lab isolation still must hold.
  await page.keyboard.press('m');
  await waitForSceneReady(page, 'main-menu');

  expect(await page.evaluate(() => window.localStorage.getItem('storycrush.game-flow'))).toBe(
    originalPayload,
  );
});
