import { expect, test, type Page } from '@playwright/test';
import {
  buildE2EUrl,
  getTestStatus,
  statusSelector,
  waitForSceneReady,
} from './browserTestHelpers';

const levels = [
  {
    id: 'archive-stabilization',
    title: 'Archive Stabilization',
    moves: '15',
    objective: 'Score 600',
    allowed: 'ruby,sapphire,emerald,topaz,amethyst,pearl',
  },
  {
    id: 'moonwell-recovery',
    title: 'Moonwell Recovery',
    moves: '12',
    objective: 'Score 700',
    allowed: 'sapphire,emerald,topaz,amethyst,pearl',
  },
  {
    id: 'rootbound-seal',
    title: 'Rootbound Seal',
    moves: '10',
    objective: 'Score 900',
    allowed: 'ruby,emerald,topaz,amethyst,pearl',
  },
] as const;

async function clickSceneButton(page: Page, xRatio: number, yRatio: number): Promise<void> {
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  await canvas.click({ position: { x: bounds.width * xRatio, y: bounds.height * yRatio } });
}

async function submitExpectedMove(page: Page): Promise<void> {
  const status = getTestStatus(page);
  const from = (await status.getAttribute('data-expected-move-from'))?.split(':').map(Number);
  const to = (await status.getAttribute('data-expected-move-to'))?.split(':').map(Number);
  if (!from || !to || from.length !== 2 || to.length !== 2) {
    throw new Error('Expected generated board move diagnostics');
  }
  const numberAttribute = async (name: string) => Number(await status.getAttribute(`data-${name}`));
  const logicalWidth = await numberAttribute('logical-canvas-width');
  const logicalHeight = await numberAttribute('logical-canvas-height');
  const boardX = await numberAttribute('board-x');
  const boardY = await numberAttribute('board-y');
  const cellSize = await numberAttribute('cell-size');
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  const click = async ([row, column]: number[]) => {
    await canvas.click({
      position: {
        x: ((boardX + column * cellSize + cellSize / 2) / logicalWidth) * bounds.width,
        y: ((boardY + row * cellSize + cellSize / 2) / logicalHeight) * bounds.height,
      },
    });
  };
  await click(from);
  await click(to);
}

test('selects and plays every Fantasy level with visible run details', async ({ page }) => {
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  for (const [index, level] of levels.entries()) {
    await clickSceneButton(page, 0.5, 0.5);
    await waitForSceneReady(page, 'puzzle-lab');
    await page.keyboard.press(String(index + 1));
    const status = await waitForSceneReady(page, 'puzzle');
    await expect(status).toHaveAttribute('data-level-id', level.id);
    await expect(status).toHaveAttribute('data-level-title', level.title);
    await expect(status).toHaveAttribute('data-move-limit', level.moves);
    await expect(status).toHaveAttribute('data-objective-summary', new RegExp(level.objective));
    await expect(status).toHaveAttribute('data-allowed-piece-types', level.allowed);
    await expect(status).toHaveAttribute('data-launch-mode', 'puzzle-lab');
    await expect(status).toHaveAttribute('data-expected-move-from', /^\d+:\d+$/);
    await page.keyboard.press('m');
    await waitForSceneReady(page, 'main-menu');
  }
});

test('replays an explicit level and seed with the same initial board hash', async ({ page }) => {
  await page.goto(buildE2EUrl({ level: 'archive-stabilization', seed: 1807 }));
  const status = await waitForSceneReady(page, 'puzzle');
  const initialHash = await status.getAttribute('data-initial-board-hash');
  await page.reload();
  await waitForSceneReady(page, 'puzzle');
  await expect(getTestStatus(page)).toHaveAttribute('data-initial-board-hash', initialHash!);
});

test('known different seeds produce different initial boards', async ({ page }) => {
  await page.goto(buildE2EUrl({ level: 'archive-stabilization', seed: 1807 }));
  await waitForSceneReady(page, 'puzzle');
  const firstHash = await getTestStatus(page).getAttribute('data-initial-board-hash');
  await page.goto(buildE2EUrl({ level: 'archive-stabilization', seed: 1808 }));
  await waitForSceneReady(page, 'puzzle');
  await expect(getTestStatus(page)).not.toHaveAttribute('data-initial-board-hash', firstHash!);
});

test('Restart Same Board restores the run after an accepted move', async ({ page }) => {
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
  await page.goto(buildE2EUrl({ level: 'moonwell-recovery', seed: 1807 }));
  const status = await waitForSceneReady(page, 'puzzle');
  const seed = await status.getAttribute('data-seed');
  const initialHash = await status.getAttribute('data-initial-board-hash');
  await submitExpectedMove(page);
  await expect(status).toHaveAttribute('data-last-move-accepted', 'true');
  await expect(status).toHaveAttribute('data-playback-sequence', '1');
  await page.keyboard.press('r');
  await expect(status).toHaveAttribute('data-restart-count', '1');
  await expect(status).toHaveAttribute('data-seed', seed!);
  await expect(status).toHaveAttribute('data-current-board-hash', initialHash!);
});

test('New Board keeps the Puzzle Lab level and advances the E2E seed', async ({ page }) => {
  await page.goto(buildE2EUrl({ level: 'rootbound-seal', seed: 1807 }));
  const status = await waitForSceneReady(page, 'puzzle');
  const initialHash = await status.getAttribute('data-initial-board-hash');
  await page.keyboard.press('b');
  await expect(status).toHaveAttribute('data-new-board-count', '1');
  await expect(status).toHaveAttribute('data-level-id', 'rootbound-seal');
  await expect(status).toHaveAttribute('data-seed', '1808');
  await expect(status).not.toHaveAttribute('data-initial-board-hash', initialHash!);
});

test('campaign resume reconstructs its persisted run descriptor', async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem('phase3a-campaign-installed') === 'true') return;
    window.sessionStorage.setItem('phase3a-campaign-installed', 'true');
    window.localStorage.clear();
    window.localStorage.setItem(
      'storycrush.game-flow',
      JSON.stringify({
        schemaVersion: 3,
        savedAtEpochMs: 42,
        state: {
          currentNodeId: 'puzzle',
          storyFlags: ['FANTASY_ARCHIVE_STABILIZED'],
          chapterStatus: { 'fantasy-chapter': { status: 'in-progress' } },
          activeLevelRun: { levelId: 'moonwell-recovery', seed: 4242 },
          latestPuzzleResult: null,
          hasContinuableSession: true,
        },
      }),
    );
  });
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  await page.keyboard.press('c');
  const status = await waitForSceneReady(page, 'puzzle');
  const initialHash = await status.getAttribute('data-initial-board-hash');
  await expect(status).toHaveAttribute('data-launch-mode', 'campaign');
  await expect(status).toHaveAttribute('data-level-id', 'moonwell-recovery');
  await expect(status).toHaveAttribute('data-seed', '4242');
  await page.reload();
  await waitForSceneReady(page, 'main-menu');
  await page.keyboard.press('c');
  await waitForSceneReady(page, 'puzzle');
  await expect(getTestStatus(page)).toHaveAttribute('data-initial-board-hash', initialHash!);
});

test('migrates v2 without fabricating an active run', async ({ page }) => {
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
          chapterStatus: { 'fantasy-chapter': { status: 'completed', lastOutcome: 'won' } },
          latestPuzzleResult: { outcome: 'won', score: 1000, movesRemaining: 2 },
          hasContinuableSession: true,
        },
      }),
    );
  });
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  const payload = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('storycrush.game-flow') ?? 'null'),
  );
  expect(payload).toMatchObject({ schemaVersion: 3, state: { activeLevelRun: null } });
});

test('Puzzle Lab replay remains isolated from campaign persistence', async ({ page }) => {
  const campaignPayload = JSON.stringify({
    schemaVersion: 3,
    savedAtEpochMs: 42,
    state: {
      currentNodeId: 'results',
      storyFlags: ['FANTASY_ARCHIVE_STABILIZED'],
      chapterStatus: { 'fantasy-chapter': { status: 'completed', lastOutcome: 'won' } },
      activeLevelRun: null,
      latestPuzzleResult: { outcome: 'won', score: 1000, movesRemaining: 2 },
      hasContinuableSession: true,
    },
  });
  await page.addInitScript((payload) => {
    if (window.sessionStorage.getItem('phase3a-isolation-installed') === 'true') return;
    window.sessionStorage.setItem('phase3a-isolation-installed', 'true');
    window.localStorage.clear();
    window.localStorage.setItem('storycrush.game-flow', payload);
  }, campaignPayload);

  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  const persistedBaseline = await page.evaluate(() =>
    window.localStorage.getItem('storycrush.game-flow'),
  );
  for (const [index] of levels.entries()) {
    await clickSceneButton(page, 0.5, 0.5);
    await waitForSceneReady(page, 'puzzle-lab');
    await page.keyboard.press(String(index + 1));
    await waitForSceneReady(page, 'puzzle');
    await page.keyboard.press('r');
    await page.keyboard.press('b');
    await page.keyboard.press('m');
    await waitForSceneReady(page, 'main-menu');
    expect(await page.evaluate(() => window.localStorage.getItem('storycrush.game-flow'))).toBe(
      persistedBaseline,
    );
  }
});

test('required mobile-first viewports keep the board inside the canvas', async ({ page }) => {
  const viewports = [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 844, height: 390 },
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(buildE2EUrl({ level: 'archive-stabilization', seed: 1807 }));
    const status = await waitForSceneReady(page, 'puzzle');
    const numberAttribute = async (name: string) =>
      Number(await status.getAttribute(`data-${name}`));
    const boardX = await numberAttribute('board-x');
    const boardY = await numberAttribute('board-y');
    const cellSize = await numberAttribute('cell-size');
    const rows = await numberAttribute('board-rows');
    const columns = await numberAttribute('board-columns');
    const logicalWidth = await numberAttribute('logical-canvas-width');
    const logicalHeight = await numberAttribute('logical-canvas-height');
    expect(boardX).toBeGreaterThanOrEqual(0);
    expect(boardY).toBeGreaterThanOrEqual(0);
    expect(boardX + cellSize * columns).toBeLessThanOrEqual(logicalWidth);
    expect(boardY + cellSize * rows).toBeLessThanOrEqual(logicalHeight);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await expect(page.locator(statusSelector)).toHaveAttribute('data-render-consistency', 'passed');
});
