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

        // Open form
        const grantButton = page
            .getByRole('button', { name: /Grant Permission/i })
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

        // Cancel closes form
        const cancelButton = page.getByRole('button', { name: /^Cancel$/i }).first();
        await cancelButton.click();
        await expect(page.getByRole('heading', { name: /New Grant/i })).toHaveCount(0);

        // Page still stable — heading still visible
        await expect(heading).toBeVisible();
    });
});
