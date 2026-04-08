import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Admin dashboard', () => {
    test('shows Dashboard heading after login', async ({ page }) => {
        await login(page);

        const response = await page.goto('/tr/admin');
        expect(response?.status(), 'admin page HTTP status').toBeLessThan(400);

        // Turkish dashboard title is "Gösterge Paneli"; fall back to "Dashboard" if i18n varies.
        const heading = page
            .getByRole('heading', { name: /Gösterge Paneli|Dashboard/i })
            .first();
        await expect(heading).toBeVisible();
    });
});
