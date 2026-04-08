import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Admin revisions', () => {
    test('loads revisions page with filters and table/empty state', async ({ page }) => {
        await login(page);

        const response = await page.goto('/en/admin/revisions');
        expect(response?.status(), 'revisions HTTP status').toBeLessThan(400);

        const heading = page
            .getByRole('heading', { name: /Revision History|Revisions/i })
            .first();
        await expect(heading).toBeVisible();

        // Resource filter label
        const resourceFilterLabel = page.getByText(/^Resource$/i).first();
        await expect(resourceFilterLabel).toBeVisible();

        // Resource filter is a native <select> — change it to verify it's wired.
        const resourceSelect = page.locator('select').first();
        await expect(resourceSelect).toBeVisible();
        await resourceSelect.selectOption({ index: 0 });

        // After filter change, either empty state or a list container should be present.
        const empty = page.getByText(/No revisions recorded yet/i);
        const list = page.locator('.divide-y').first();
        await expect(empty.or(list)).toBeVisible();
    });
});
