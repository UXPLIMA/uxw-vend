import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for uxwVend E2E tests.
 *
 * No `webServer` is configured on purpose: locally the suite runs against the
 * server you already have up (PM2, `npm run dev`), and letting Playwright boot
 * its own would fight with it over the port. CI starts the server itself and
 * points `E2E_BASE_URL` at it.
 *
 * `retries` stays at 0 and `workers` at 1 - these tests share one database and
 * one admin session, so parallelism makes them flake rather than run faster.
 */
export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'off',
        actionTimeout: 10_000,
        navigationTimeout: 20_000,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
