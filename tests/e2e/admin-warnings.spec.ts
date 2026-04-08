import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Admin warnings', () => {
    test('opens issue warning form and searches users', async ({ page }) => {
        await login(page);

        const response = await page.goto('/en/admin/warnings');
        expect(response?.status(), 'warnings HTTP status').toBeLessThan(400);

        const heading = page
            .getByRole('heading', { name: /User Warnings|Warnings/i })
            .first();
        await expect(heading).toBeVisible();

        // Either empty state or table row should render
        const empty = page.getByText(/No warnings have been issued/i);
        const list = page.locator('.divide-y').first();
        await expect(empty.or(list)).toBeVisible();

        // Open composer
        const issueButton = page.getByRole('button', { name: /Issue Warning/i }).first();
        await expect(issueButton).toBeVisible();
        await issueButton.click();

        await expect(
            page.getByRole('heading', { name: /New Warning/i }).first(),
        ).toBeVisible();

        // Type into user search — suggestions may or may not appear depending on data
        const userSearch = page
            .locator('input[placeholder*="username" i], input[autocomplete="off"]')
            .first();
        await expect(userSearch).toBeVisible();
        await userSearch.fill('admin');

        // Give debounce time
        await page.waitForTimeout(500);

        // Close via Cancel
        await page.getByRole('button', { name: /^Cancel$/i }).first().click();
        await expect(page.getByRole('heading', { name: /New Warning/i })).toHaveCount(0);
    });
});
