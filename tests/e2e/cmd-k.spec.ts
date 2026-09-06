import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Admin Cmd+K spotlight', () => {
    test('opens spotlight, searches "users", and navigates on Enter', async ({ page }) => {
        await login(page);

        // The English admin, because the query below is an English word: the
        // spotlight searches page titles, so typing "users" on the Turkish
        // admin - where that page is called Kullanicilar - would be asking
        // for a result that does not exist.
        await page.goto('/en/admin');
        await expect(
            page.getByRole('heading', { name: /Dashboard/i }).first(),
        ).toBeVisible();

        // Trigger the spotlight via Ctrl+K. AdminSpotlight listens on window.
        await page.keyboard.press('Control+KeyK');

        // Located by structure, not by wording. This assertion used to name
        // the placeholder's English sentence, so the day that sentence became
        // a translated key the test could only ever pass in one language -
        // and it was being run in the other one.
        const spotlightInput = page.getByRole('dialog').getByRole('textbox');
        await expect(spotlightInput).toBeVisible({ timeout: 5_000 });

        await spotlightInput.fill('users');

        // Wait for the debounced (200ms) fetch and the rendered result button.
        // Spotlight renders each hit as a <button> whose accessible name looks
        // like "Users page" (title + type label).
        //
        // Scoped to the dialog: searched across the whole page this matched the
        // dashboard's own "Users" card behind the overlay, which is visible
        // immediately. The wait then ended before the search had answered, and
        // Enter arrived while the result list was still empty.
        const usersResult = page
            .getByRole('dialog')
            .getByRole('button', { name: /Users/i })
            .first();
        await expect(usersResult).toBeVisible({ timeout: 10_000 });

        // Press Enter on the focused spotlight input - this triggers router.push.
        await spotlightInput.press('Enter');

        await page.waitForURL(/\/admin\/users/, { timeout: 10_000 });
        expect(page.url()).toContain('/admin/users');
    });
});
