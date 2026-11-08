import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;

/**
 * Multi-tab end-to-end tests. Each test opens the four roles as four tabs of one browser, the way the
 * demo is presented, and checks that they stay in sync without a refresh.
 * It uses the Chrome that is already installed, so there is no browser download.
 */
export default defineConfig({
  testDir: './e2e',
  // The PWA test needs the production build (playwright.pwa.config.ts), and the server test needs the
  // server (playwright.server.config.ts).
  testIgnore: ['**/pwa.spec.ts', '**/server.spec.ts'],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
