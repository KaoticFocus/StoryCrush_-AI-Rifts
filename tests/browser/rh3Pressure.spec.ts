import { expect, test, type Page } from '@playwright/test';
import { buildE2EUrl, buildPlaytestUrl, waitForSceneReady } from './browserTestHelpers';

const catalogOrder = [
  { id: 'archive-stabilization', title: 'Archive Stabilization', key: '1' },
  { id: 'moonwell-recovery', title: 'Moonwell Recovery', key: '2' },
  { id: 'thornwake-containment', title: 'Thornwake Containment', key: '3' },
  { id: 'rootbound-seal', title: 'Rootbound Seal', key: '4' },
  { id: 'rift-erosion-lab', title: 'Rift Erosion Lab', key: '5' },
] as const;

function collectBrowserErrors(page: Page): { assertNone(): void } {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return { assertNone: () => expect(errors).toEqual([]) };
}

const levelControls = (page: Page) => page.getByRole('button', { name: /^Play / });

async function clickSceneButton(page: Page, xRatio: number, yRatio: number): Promise<void> {
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Expected Phaser canvas bounds');
  await canvas.click({ position: { x: bounds.width * xRatio, y: bounds.height * yRatio } });
}

async function waitForPuzzleSceneActive(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const puzzle = window.__storyCrushGame?.scene.getScene('PuzzleScene');
          return Boolean(puzzle?.sys?.isActive?.());
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
}

async function openPuzzleLabFromMainMenu(page: Page): Promise<void> {
  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle-lab');
}

async function waitForMainMenuActive(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const menu = window.__storyCrushGame?.scene.getScene('MainMenuScene');
          return Boolean(menu?.sys?.isActive?.());
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
}

async function launchPlaytestFromMainMenu(page: Page): Promise<void> {
  await waitForMainMenuActive(page);
  await clickSceneButton(page, 0.5, 0.5);
  await waitForPuzzleSceneActive(page);
}

async function readPuzzleSceneLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const scene = (
      window as unknown as {
        __storyCrushGame?: {
          scene: { getScene: (key: string) => { children: { list: unknown[] } } };
        };
      }
    ).__storyCrushGame?.scene.getScene('PuzzleScene');
    const labels: string[] = [];
    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const maybeText = node as { text?: unknown; list?: unknown[] };
      if (typeof maybeText.text === 'string' && maybeText.text) {
        labels.push(maybeText.text);
      }
      if (Array.isArray(maybeText.list)) {
        for (const child of maybeText.list) visit(child);
      }
    };
    scene?.children.list.forEach(visit);
    return labels;
  });
}

async function readPuzzleLabLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const scene = window.__storyCrushGame?.scene.getScene('PuzzleLabScene');
    return (
      scene?.children.list
        .map((child) => ('text' in child ? String(child.text) : ''))
        .filter(Boolean) ?? []
    );
  });
}

test('Puzzle Lab lists five Play controls in catalog order with keyboard shortcuts', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(90_000);
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  await openPuzzleLabFromMainMenu(page);

  await expect(levelControls(page)).toHaveCount(5);
  for (const [index, level] of catalogOrder.entries()) {
    await expect(levelControls(page).nth(index)).toHaveAccessibleName(
      new RegExp(`^Play ${level.title}`),
    );
  }

  for (const [index, level] of catalogOrder.entries()) {
    if (index > 0) {
      await page.keyboard.press('m');
      await waitForSceneReady(page, 'main-menu');
      await openPuzzleLabFromMainMenu(page);
    }
    await page.keyboard.press(level.key);
    const status = await waitForSceneReady(page, 'puzzle');
    await expect(status).toHaveAttribute('data-level-id', level.id);
  }
  errors.assertNone();
});

test('pressure badges distinguish Fantasy Pressure from calm and lab levels', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle-lab');

  await expect(
    page.getByRole('button', { name: /^Play Archive Stabilization/ }),
  ).not.toHaveAccessibleName(/Fantasy Pressure/);
  await expect(
    page.getByRole('button', { name: /^Play Moonwell Recovery/ }),
  ).not.toHaveAccessibleName(/Fantasy Pressure/);
  await expect(page.getByRole('button', { name: /^Play Rootbound Seal/ })).not.toHaveAccessibleName(
    /Fantasy Pressure/,
  );

  await expect(
    page.getByRole('button', { name: /^Play Thornwake Containment/ }),
  ).toHaveAccessibleName(/Fantasy Pressure/);
  await expect(page.getByRole('button', { name: /^Play Rift Erosion Lab/ })).toHaveAccessibleName(
    /Experimental Rift Hunger/,
  );
  await expect(
    page.getByRole('button', { name: /^Play Rift Erosion Lab/ }),
  ).not.toHaveAccessibleName(/^Play Rift Erosion Lab\. Fantasy Pressure/);

  const labLabels = await readPuzzleLabLabels(page);
  expect(labLabels.some((text) => text.includes('Fantasy Pressure'))).toBe(true);
  expect(labLabels.some((text) => text.includes('Experimental Rift Hunger'))).toBe(true);
  expect(labLabels.filter((text) => text === 'Fantasy Pressure').length).toBe(1);
  errors.assertNone();
});

test('phone portrait keeps five controls and Back to Main Menu reachable', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle-lab');

  await expect(levelControls(page)).toHaveCount(5);
  const controls = levelControls(page);
  for (let index = 0; index < 5; index += 1) {
    const box = await controls.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  }

  const labLabels = await readPuzzleLabLabels(page);
  expect(labLabels).toContain('Back to Main Menu');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  errors.assertNone();
});

test('playtest URL launches Thornwake from Main Menu and preserves seed on restart', async ({
  page,
}) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildPlaytestUrl({ level: 'thornwake-containment', seed: 1831 }));
  await expect(page.locator('canvas')).toBeVisible();
  await launchPlaytestFromMainMenu(page);

  const labels = await readPuzzleSceneLabels(page);
  expect(labels.some((text) => text.includes('Playtest seed 1831'))).toBe(true);
  await expect(page.locator('#storycrush-status')).toContainText(/Playtest seed 1831/i);

  const initialHash = await page.evaluate(() => {
    const scene = window.__storyCrushGame?.scene.getScene('PuzzleScene') as {
      initialBoardHash?: string;
    };
    return scene?.initialBoardHash ?? '';
  });
  expect(initialHash.length).toBeGreaterThan(0);

  await page.keyboard.press('r');
  await waitForPuzzleSceneActive(page);
  const labelsAfterRestart = await readPuzzleSceneLabels(page);
  expect(labelsAfterRestart.some((text) => text.includes('Playtest seed 1831'))).toBe(true);
  await expect(page.locator('.rh3-playtest-summary')).toBeHidden();

  const hashAfterRestart = await page.evaluate(() => {
    const scene = window.__storyCrushGame?.scene.getScene('PuzzleScene') as {
      initialBoardHash?: string;
    };
    return scene?.initialBoardHash ?? '';
  });
  expect(hashAfterRestart).toBe(initialHash);
  errors.assertNone();
});

test('playtest New Board exits fixed seed mode and announces a new seed', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildPlaytestUrl({ level: 'thornwake-containment', seed: 1831 }));
  await expect(page.locator('canvas')).toBeVisible();
  await launchPlaytestFromMainMenu(page);

  await page.keyboard.press('b');
  await waitForPuzzleSceneActive(page);

  const labels = await readPuzzleSceneLabels(page);
  expect(labels.some((text) => text.includes('Playtest seed 1831'))).toBe(false);
  await expect(page.locator('.rh3-playtest-summary')).toBeHidden();
  await expect(page.locator('#storycrush-status')).toContainText(
    /New Board started with a new seed/i,
  );
  const playtestExited = await page.evaluate(() => {
    const scene = window.__storyCrushGame?.scene.getScene('PuzzleScene') as {
      launchContext?: { playtest?: boolean };
    };
    return scene?.launchContext?.playtest !== true;
  });
  expect(playtestExited).toBe(true);
  errors.assertNone();
});

test('ordinary URL without playtest query omits playtest summary UI', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl());
  await waitForSceneReady(page, 'main-menu');
  await clickSceneButton(page, 0.5, 0.5);
  await waitForSceneReady(page, 'puzzle-lab');
  await page.getByRole('button', { name: 'Play Archive Stabilization' }).click();
  await waitForSceneReady(page, 'puzzle');
  await expect(page.locator('.rh3-playtest-summary')).toHaveCount(0);
  const labels = await readPuzzleSceneLabels(page);
  expect(labels.some((text) => text.includes('Playtest seed'))).toBe(false);
  errors.assertNone();
});

test('Thornwake e2e deep link exposes threat HUD and move limit 18', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto(buildE2EUrl({ level: 'thornwake-containment', seed: 1831 }));
  const status = await waitForSceneReady(page, 'puzzle');
  await expect(status).toHaveAttribute('data-level-id', 'thornwake-containment');
  await expect(status).toHaveAttribute('data-move-limit', '18');
  await expect(status).toHaveAttribute('data-threat-status', 'active');
  await expect(status).toHaveAttribute('data-threat-hunger-maximum', '5');
  await expect(status).toHaveAttribute('data-threat-moves-until-spread', '3');
  await expect(status).toHaveAttribute('data-threat-corrupted-coordinates', /7:3/);
  await expect(status).toHaveAttribute('data-objective-summary', /Score 3000/);
  await expect(status).toHaveAttribute('data-objective-summary', /Collect 9 topaz/i);
  errors.assertNone();
});
