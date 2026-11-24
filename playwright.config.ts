import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const isCI = !!process.env.CI;
// Locally you can point Playwright at an installed Chrome with PW_CHANNEL=chrome.
const channel = process.env.PW_CHANNEL;

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'reports/playwright-junit.xml' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'off',
    testIdAttribute: 'data-testid',
  },
  projects: [
    { name: 'api', testDir: './tests/api' },
    { name: 'db', testDir: './tests/db' },
    {
      name: 'e2e-chromium',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) },
    },
    ...(isCI
      ? [{ name: 'e2e-firefox', testDir: './tests/e2e', use: { ...devices['Desktop Firefox'] } }]
      : []),
  ],
  webServer: {
    command: 'npm start',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
