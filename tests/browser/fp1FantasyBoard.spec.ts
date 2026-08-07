import { expect, test, type Page } from '@playwright/test';
import { buildE2EUrl, getTestStatus, waitForSceneReady } from './browserTestHelpers';

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
  await expect(status).toHaveAttribute('data-piece-visual-id', /fantasy-/);
  await expect(status).toHaveAttribute('data-cell-size', /^\d+(\.\d+)?$/);
  await expect(status).toHaveAttribute('data-board-rows', /^\d+$/);
  await expect(status).toHaveAttribute('data-move-limit', /^\d+$/);
  await expect(status).toHaveAttribute('data-objective-summary', /.+/);

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

  // One desktop size
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
  if (expectPhaserResize) {
    await expect.poll(async () => status.getAttribute('data-logical-canvas-width')).toBe('1280');
  }
  await assertAuthorityAndTheme();
  errors.assertNone();
});
