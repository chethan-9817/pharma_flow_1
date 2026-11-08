import { defineConfig, devices } from '@playwright/test';

const PORT = 8788;

/**
 * Server-mode tests: they build the server build, start the real server (API, WebSocket and the app on one
 * port, with a throw-away in-memory database) and sign in with real passwords.
 * Run them with: npm run test:e2e:server
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/server.spec.ts',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'npm run build:server && npm run server',
    url: `http://localhost:${PORT}/api/health`,
    env: { PORT: String(PORT), PHARMAFLOW_DB: ':memory:', PHARMAFLOW_DEMO_PASSWORD: 'pharmaflow' },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
