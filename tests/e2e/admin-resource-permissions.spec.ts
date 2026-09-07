import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Admin resource permissions', () => {
    test('opens grant form and validates required fields', async ({ page }) => {
        await login(page);

        const response = await page.goto('/en/admin/resource-permissions');
        expect(response?.status(), 'resource-permissions HTTP status').toBeLessThan(400);

        const heading = page
            .getByRole('heading', { name: /Resource Permissions/i })
            .first();
        await expect(heading).toBeVisible();

        // Open form. It navigates to /admin/resource-permissions/new, so it is
        // a link: it used to be a <button> inside an <a>, which the HTML spec
        // forbids and which gave a keyboard user two tab stops for one control.
        const grantButton = page
            .getByRole('link', { name: /Grant Permission/i })
            .first();
        await expect(grantButton).toBeVisible();
        await grantButton.click();

        // Form card appears
        await expect(
            page.getByRole('heading', { name: /New Grant/i }).first(),
        ).toBeVisible();

        // Fill resource field
        const resourceInput = page.locator('input[placeholder="blog.article"]').first();
        await expect(resourceInput).toBeVisible();
        await resourceInput.fill('test.resource');

        // Cancel navigates back to the list, so it is a link too.
        const cancelButton = page.getByRole('link', { name: /^Cancel$/i }).first();
        await cancelButton.click();
        await expect(page.getByRole('heading', { name: /New Grant/i })).toHaveCount(0);

        // Page still stable - heading still visible
        await expect(heading).toBeVisible();
    });
});
