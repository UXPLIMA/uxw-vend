import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Theme Customizer', () => {
    test('loads customizer page with heading and save button', async ({ page }) => {
        await login(page);

        const response = await page.goto('/tr/admin/settings/customizer');
        expect(response?.status(), 'customizer HTTP status').toBeLessThan(400);

        const heading = page
            .getByRole('heading', { name: /Theme Customizer|Tema Düzenleyici/i })
            .first();
        await expect(heading).toBeVisible();

        // Save button — could be "Save", "Kaydet", or part of a longer label.
        const saveButton = page
            .getByRole('button', { name: /Save|Kaydet/i })
            .first();
        await expect(saveButton).toBeVisible();
    });
});
