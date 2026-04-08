import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Admin rate limits settings', () => {
    test('renders heading and at least one role slider without JS errors', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('pageerror', (err) => {
            consoleErrors.push(err.message);
        });

        await login(page);

        const response = await page.goto('/en/admin/settings/rate-limits');
        expect(response?.status(), 'rate-limits HTTP status').toBeLessThan(400);

        const heading = page
            .getByRole('heading', { name: /API Rate Limits/i })
            .first();
        await expect(heading).toBeVisible();

        // At least one role slider (range input) — appears after data fetch
        const slider = page.locator('input[type="range"]').first();
        await expect(slider).toBeVisible({ timeout: 15_000 });

        // Save button is present but we do NOT click it
        const saveButton = page.getByRole('button', { name: /^Save$/i }).first();
        await expect(saveButton).toBeVisible();

        // No hard JS errors
        expect(
            consoleErrors,
            `unexpected page errors:\n${consoleErrors.join('\n')}`,
        ).toEqual([]);
    });
});
