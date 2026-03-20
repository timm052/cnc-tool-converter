import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration
 *
 * Web project   — starts `npm run preview` (production build) on port 4173.
 *                 Run:  npm run test:e2e
 *
 * Tauri project — expects `npm run tauri:dev` to already be running on
 *                 port 5173 (or set TAURI_DEV_URL env var).
 *                 Run:  npm run test:e2e:tauri
 *
 * Before first run: npx playwright install --with-deps
 */
export default defineConfig({
  testDir:   './e2e',
  timeout:   30_000,
  expect:    { timeout: 5_000 },
  fullyParallel: false,   // SPA state is shared — run serially to avoid interference
  retries:   process.env.CI ? 2 : 0,
  workers:   1,
  reporter:  process.env.CI ? 'github' : 'list',

  use: {
    trace:      'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── Web app — served via `vite preview` ──────────────────────────────────
    {
      name:    'web-chrome',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4173',
      },
    },
    {
      name:    'web-firefox',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: 'http://localhost:4173',
      },
    },

    // ── Tauri desktop app (dev mode) ─────────────────────────────────────────
    // The Tauri WebView embeds the same frontend on localhost:5173 in dev mode.
    // Start it manually with: npm run tauri:dev
    {
      name: 'tauri',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.TAURI_DEV_URL ?? 'http://localhost:5173',
        // Tauri opens its own window; we can't close it between tests,
        // so re-use the same context throughout.
        contextOptions: { ignoreHTTPSErrors: true },
      },
    },
  ],

  // Automatically start the preview server for web projects
  webServer: [
    {
      command:  'npm run preview',
      url:      'http://localhost:4173',
      timeout:  30_000,
      reuseExistingServer: !process.env.CI,
      // Only start for non-tauri projects
      ...(process.env.PLAYWRIGHT_PROJECT === 'tauri' ? { command: 'echo skip' } : {}),
    },
  ],
});
