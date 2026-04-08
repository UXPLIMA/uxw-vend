import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for uxwVend E2E tests.
 * Runs against the live PM2 instance on http://127.0.0.1:3001.
 * No webServer is configured — we assume the dev/prod server is already running.
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
        baseURL: 'http://127.0.0.1:3001',
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
