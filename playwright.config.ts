/* global process */
import { defineConfig, devices } from '@playwright/test';

const preview = process.env.PLAYWRIGHT_PREVIEW === '1';
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const port = preview ? 4174 : 4173;
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  retries: process.env.CI === 'true' ? 1 : 0,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL,
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
  webServer: externalBaseURL
    ? undefined
    : {
        command: preview
          ? 'npm run build && npm run preview -- --host 127.0.0.1 --port 4174'
          : 'npm run dev -- --host 127.0.0.1 --port 4173',
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: true,
      },
});
