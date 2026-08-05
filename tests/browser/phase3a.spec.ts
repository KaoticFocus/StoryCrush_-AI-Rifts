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
    objective: 'Score 2500',
    scoreTarget: '2500',
    allowed: 'ruby,sapphire,emerald,topaz,amethyst,pearl',
  },
  {
    id: 'moonwell-recovery',
    title: 'Moonwell Recovery',
    moves: '12',
    objective: 'Score 3500',
    scoreTarget: '3500',
    allowed: 'sapphire,emerald,topaz,amethyst,pearl',
  },
  {
    id: 'thornwake-containment',
    title: 'Thornwake Containment',
    moves: '18',
    objective: 'Score 3000',
    scoreTarget: '3000',
    allowed: 'ruby,sapphire,emerald,topaz,amethyst,pearl',
  },
  {
    id: 'rootbound-seal',
    title: 'Rootbound Seal',
    moves: '10',
    objective: 'Score 5000',
    scoreTarget: '5000',
    allowed: 'ruby,emerald,topaz,amethyst,pearl',
  },
  {
    id: 'rift-erosion-lab',
    title: 'Rift Erosion Lab',
    moves: '15',
    objective: 'Score 2200',
    scoreTarget: '2200',
    allowed: 'ruby,sapphire,emerald,topaz,amethyst,pearl',
  },
] as const;

async function clickSceneButton(page: Page, xRatio: number, yRatio: number): Promise<void> {
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  await canvas.click({ position: { x: bounds.width * xRatio, y: bounds.height * yRatio } });
}

function collectBrowserErrors(page: Page): { assertNone(): void } {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return { assertNone: () => expect(errors).toEqual([]) };
}

const levelControls = (page: Page) => page.getByRole('button', { name: /^Play / });

async function pieceCenterOnCanvas(
  page: Page,
  coordinate: readonly [number, number],
): Promise<{ x: number; y: number; clientX: number; clientY: number }> {
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
  const x = ((boardX + column * cellSize + cellSize / 2) / logicalWidth) * bounds.width;
  const y = ((boardY + row * cellSize + cellSize / 2) / logicalHeight) * bounds.height;
  return { x, y, clientX: bounds.x + x, clientY: bounds.y + y };
}

async function assertCanvasOwnsPieceCenter(page: Page, coordinate: readonly [number, number]) {
  const point = await pieceCenterOnCanvas(page, coordinate);
  const top = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return {
        tag: el?.tagName ?? 'none',
        id: el?.id ?? '',
        className: typeof el?.className === 'string' ? el.className : '',
      };
    },
    { x: point.clientX, y: point.clientY },
  );
  expect(
    top,
    `piece center ${coordinate.join(':')} intercepted by ${JSON.stringify(top)}`,
  ).toMatchObject({ tag: 'CANVAS' });
  return point;
}

async function submitExpectedMove(page: Page): Promise<void> {
  const status = getTestStatus(page);
  const from = (await status.getAttribute('data-expected-move-from'))?.split(':').map(Number);
  const to = (await status.getAttribute('data-expected-move-to'))?.split(':').map(Number);
  if (!from || !to || from.length !== 2 || to.length !== 2) {
    throw new Error('Expected generated board move diagnostics');
  }
  const canvas = page.locator('canvas');
  const fromPoint = await assertCanvasOwnsPieceCenter(page, from as [number, number]);
  await canvas.click({ position: { x: fromPoint.x, y: fromPoint.y } });
  await expect(status).toHaveAttribute('data-selected-coordinate', `${from[0]}:${from[1]}`);
  const toPoint = await assertCanvasOwnsPieceCenter(page, to as [number, number]);
  const movesBefore = await status.getAttribute('data-moves-remaining');
  const hashBefore = await status.getAttribute('data-current-board-hash');
  await canvas.click({ position: { x: toPoint.x, y: toPoint.y } });
  await expect(status).toHaveAttribute('data-last-move-accepted', 'true');
  await expect(status).toHaveAttribute('data-playback-state', 'idle');
  await expect(status).not.toHaveAttribute('data-moves-remaining', movesBefore ?? '');
  await expect(status).not.toHaveAttribute('data-current-board-hash', hashBefore ?? '');
}

test('single click opens Puzzle Lab selector without launching a level', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await expect(getTestStatus(page)).toHaveAttribute('data-scene', 'main-menu');
  await page.mouse.up();

  await waitForSceneReady(page, 'puzzle-lab');
  await expect(levelControls(page)).toHaveCount(5);
  await expect(getTestStatus(page)).toHaveAttribute('data-scene', 'puzzle-lab');
  await page.getByRole('button', { name: 'Play Moonwell Recovery' }).click();
  await expect(await waitForSceneReady(page, 'puzzle')).toHaveAttribute(
    'data-level-id',
    'moonwell-recovery',
  );
  errors.assertNone();
});

test('Puzzle Lab level controls expose names and ordered Tab focus', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle-lab');

  await expect(levelControls(page)).toHaveCount(5);
  await expect(levelControls(page).nth(0)).toHaveAccessibleName('Play Archive Stabilization');
  await expect(levelControls(page).nth(1)).toHaveAccessibleName('Play Moonwell Recovery');
  await expect(levelControls(page).nth(2)).toHaveAccessibleName(/Play Thornwake Containment/);
  await expect(levelControls(page).nth(3)).toHaveAccessibleName('Play Rootbound Seal');
  await expect(levelControls(page).nth(4)).toHaveAccessibleName(
    /Play Rift Erosion Lab\. Experimental Rift Hunger/,
  );
  for (const level of levels) {
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: new RegExp(`^Play ${level.title}`) }),
    ).toBeFocused();
  }
  errors.assertNone();
});

test('Puzzle Lab Enter, Space, and pointer controls share level routing', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  const activateLevel = async (method: 'Enter' | 'Space' | 'pointer') => {
    await clickSceneButton(page, 0.5, 0.5);
    await waitForSceneReady(page, 'puzzle-lab');
    const moonwell = page.getByRole('button', { name: 'Play Moonwell Recovery' });
    if (method === 'pointer') {
      await moonwell.click();
    } else {
      await moonwell.focus();
      await page.keyboard.press(method);
    }
    await expect(await waitForSceneReady(page, 'puzzle')).toHaveAttribute(
      'data-level-id',
      'moonwell-recovery',
    );
    await expect(getTestStatus(page)).toHaveAttribute('data-launch-mode', 'puzzle-lab');
  };

  for (const method of ['Enter', 'Space', 'pointer'] as const) {
    await activateLevel(method);
    if (method !== 'pointer') {
      await clickSceneButton(page, 0.86, 0.12);
      await waitForSceneReady(page, 'main-menu');
    }
  }
  errors.assertNone();
});

test('Puzzle Lab controls clean up and remain singular after returning', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle-lab');
  await expect(levelControls(page)).toHaveCount(5);

  await page.keyboard.press('Escape');
  await waitForSceneReady(page, 'main-menu');
  await expect(levelControls(page)).toHaveCount(0);
  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle-lab');
  await expect(levelControls(page)).toHaveCount(5);
  errors.assertNone();
});

test('Puzzle Lab run says Back to Menu and returns to Main Menu', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle-lab');
  await page.getByRole('button', { name: 'Play Archive Stabilization' }).click();
  await waitForSceneReady(page, 'puzzle');

  const labels = await page.evaluate(() => {
    const scene = window.__storyCrushGame?.scene.getScene('PuzzleScene');
    return scene?.children.list
      .map((child) => ('text' in child ? String(child.text) : ''))
      .filter(Boolean);
  });
  expect(labels).toContain('Back to Menu');
  expect(labels).not.toContain('Back to Map');
  await clickSceneButton(page, 0.86, 0.12);
  await waitForSceneReady(page, 'main-menu');
  errors.assertNone();
});

test('Puzzle exit keeps Main Menu status after Puzzle shutdown', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle-lab');
  await page.getByRole('button', { name: 'Play Archive Stabilization' }).click();
  await waitForSceneReady(page, 'puzzle');

  await clickSceneButton(page, 0.86, 0.12);
  await waitForSceneReady(page, 'main-menu');

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const game = window.__storyCrushGame;
        const puzzle = game?.scene.getScene('PuzzleScene');
        const menu = game?.scene.getScene('MainMenuScene');
        return {
          puzzleActive: Boolean(puzzle?.sys?.isActive?.()),
          menuActive: Boolean(menu?.sys?.isActive?.()),
          scene: document.getElementById('storycrush-test-status')?.getAttribute('data-scene'),
        };
      }),
    )
    .toEqual({ puzzleActive: false, menuActive: true, scene: 'main-menu' });

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const menu = window.__storyCrushGame?.scene.getScene('MainMenuScene');
        const scene = document.getElementById('storycrush-test-status')?.getAttribute('data-scene');
        const menuActive = Boolean(menu?.sys?.isActive?.());
        const menuObjects = menu?.children?.length ?? 0;
        return scene === 'main-menu' && menuActive && menuObjects > 0;
      }),
    )
    .toBe(true);
  await expect(getTestStatus(page)).toHaveAttribute('data-scene', 'main-menu');
  await expect(levelControls(page)).toHaveCount(0);
  await expect(page.locator('.puzzle-lab-level-controls')).toHaveCount(0);
  await expect(page.locator('.puzzle-lab-level-control')).toHaveCount(0);
  const menuCount = await page.evaluate(() => {
    const game = window.__storyCrushGame;
    return game?.scene.getScenes(true).filter((scene) => scene.scene.key === 'MainMenuScene')
      .length;
  });
  expect(menuCount).toBe(1);
  errors.assertNone();
});

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

test('Puzzle Lab pointer path selects pieces and accepts a real swap', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(60_000);
  const errors = collectBrowserErrors(page);
  // Normal catalog launch — not a fixture deep-link — reproduces production Lab entry.
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle-lab');
  await page.getByRole('button', { name: 'Play Archive Stabilization' }).click();
  const status = await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-level-id', 'archive-stabilization');
  await expect(status).toHaveAttribute('data-level-status', 'active');

  const movesAtStart = await status.getAttribute('data-moves-remaining');
  await submitExpectedMove(page);
  await expect(status).not.toHaveAttribute('data-moves-remaining', movesAtStart ?? '');

  await page.keyboard.press('r');
  await expect(status).toHaveAttribute('data-restart-count', '1');
  await expect(status).toHaveAttribute('data-playback-state', 'idle');
  await submitExpectedMove(page);

  await page.keyboard.press('b');
  await expect(status).toHaveAttribute('data-new-board-count', '1');
  await expect(status).toHaveAttribute('data-level-id', 'archive-stabilization');
  await expect(status).toHaveAttribute('data-playback-state', 'idle');
  await submitExpectedMove(page);

  await page.keyboard.press('m');
  await waitForSceneReady(page, 'main-menu');
  errors.assertNone();
});

test('longer level goals render and survive restart, new board, and campaign restore', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle-lab');

  const labLabels = await page.evaluate(() => {
    const scene = window.__storyCrushGame?.scene.getScene('PuzzleLabScene');
    return scene?.children.list
      .map((child) => ('text' in child ? String(child.text) : ''))
      .filter(Boolean);
  });
  const labText = labLabels?.join('\n') ?? '';
  expect(labText).toMatch(/2500/);
  expect(labText).toMatch(/3500/);
  expect(labText).toMatch(/3000/);
  expect(labText).toMatch(/5000/);

  for (const level of levels) {
    await page.getByRole('button', { name: `Play ${level.title}` }).click();
    const status = await waitForSceneReady(page, 'puzzle');
    await expect(status).toHaveAttribute('data-objective-summary', new RegExp(level.objective));
    await expect(status).toHaveAttribute('data-move-limit', level.moves);
    const score = Number(await status.getAttribute('data-score'));
    expect(score).toBeLessThan(Number(level.scoreTarget));
    await expect(levelControls(page)).toHaveCount(0);
    await page.keyboard.press('m');
    await waitForSceneReady(page, 'main-menu');
    await clickSceneButton(page, 0.5, 0.5);
    await waitForSceneReady(page, 'puzzle-lab');
  }

  await page.goto(buildE2EUrl({ level: 'archive-stabilization', seed: 1807 }));
  let status = await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-objective-summary', /Score 2500/);
  await page.keyboard.press('r');
  await expect(status).toHaveAttribute('data-restart-count', '1');
  await expect(status).toHaveAttribute('data-objective-summary', /Score 2500/);
  await page.keyboard.press('b');
  await expect(status).toHaveAttribute('data-new-board-count', '1');
  await expect(status).toHaveAttribute('data-level-id', 'archive-stabilization');
  await expect(status).toHaveAttribute('data-objective-summary', /Score 2500/);

  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  await page.evaluate(() => {
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
          activeLevelRun: { levelId: 'rootbound-seal', seed: 4242 },
          latestPuzzleResult: null,
          hasContinuableSession: true,
        },
      }),
    );
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForSceneReady(page, 'main-menu');
  await page.keyboard.press('c');
  status = await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-level-id', 'rootbound-seal');
  await expect(status).toHaveAttribute('data-objective-summary', /Score 5000/);
  await expect(status).toHaveAttribute('data-launch-mode', 'campaign');

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(buildE2EUrl({ level: 'rootbound-seal', seed: 1809 }));
    await waitForSceneReady(page, 'puzzle');
    await expect(getTestStatus(page)).toHaveAttribute('data-objective-summary', /Score 5000/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  errors.assertNone();
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
