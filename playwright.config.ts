/* global process */
import { defineConfig, devices } from '@playwright/test';

const preview = process.env.PLAYWRIGHT_PREVIEW === '1';
const port = preview ? 4174 : 4173;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  retries: process.env.CI === 'true' ? 1 : 0,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    { name: 'chromium-mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: {
    command: preview
      ? 'npm run build && npm run preview -- --host 127.0.0.1 --port 4174'
      : 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
  },
});
