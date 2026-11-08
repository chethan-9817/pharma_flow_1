import { defineConfig, devices } from '@playwright/test';

const PORT = 5198;

/**
 * The PWA test needs the production build, because the service worker only exists after `vite build`.
 * Run it with: npm run test:e2e:pwa
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/pwa.spec.ts',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
