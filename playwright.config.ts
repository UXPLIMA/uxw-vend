import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Blysis E2E tests.
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
        // `localhost`, not `127.0.0.1`, even though they reach the same
        // server. In dev, Next serves /_next/* only to the hosts in
        // `allowedDevOrigins`, which next.config.ts derives from AUTH_URL,
        // NEXTAUTH_URL and NEXT_PUBLIC_APP_URL - all of them `localhost` in
        // .env.example. From 127.0.0.1 every client chunk is refused, so the
        // page renders and never hydrates: a spec measuring anything a
        // component fetches was measuring an empty frame and passing.
        baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
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
