import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Admin Cmd+K spotlight', () => {
    test('opens spotlight, searches "users", and navigates on Enter', async ({ page }) => {
        await login(page);

        // Make sure AdminSpotlight is mounted by loading the admin layout.
        await page.goto('/tr/admin');
        await expect(
            page.getByRole('heading', { name: /Gösterge Paneli|Dashboard/i }).first(),
        ).toBeVisible();

        // Trigger the spotlight via Ctrl+K. AdminSpotlight listens on window.
        await page.keyboard.press('Control+KeyK');

        // The spotlight input has a distinctive placeholder.
        const spotlightInput = page.getByPlaceholder(/Search admin pages/i);
        await expect(spotlightInput).toBeVisible({ timeout: 5_000 });

        await spotlightInput.fill('users');

        // Wait for the debounced (200ms) fetch and the rendered result button.
        // Spotlight renders each hit as a <button> whose accessible name looks
        // like "Users page" (title + type label).
        const usersResult = page
            .getByRole('button', { name: /Users/i })
            .first();
        await expect(usersResult).toBeVisible({ timeout: 10_000 });

        // Press Enter on the focused spotlight input — this triggers router.push.
        await spotlightInput.press('Enter');

        await page.waitForURL(/\/admin\/users/, { timeout: 10_000 });
        expect(page.url()).toContain('/admin/users');
    });
});
