import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Admin broadcasts', () => {
    test('opens composer, fills subject and body, closes without sending', async ({ page }) => {
        await login(page);

        const response = await page.goto('/en/admin/broadcasts');
        expect(response?.status(), 'broadcasts HTTP status').toBeLessThan(400);

        const heading = page
            .getByRole('heading', { name: /Email Broadcasts/i })
            .first();
        await expect(heading).toBeVisible();

        // Open composer
        const composeButton = page.getByRole('button', { name: /^Compose$/i }).first();
        await expect(composeButton).toBeVisible();
        await composeButton.click();

        await expect(
            page.getByRole('heading', { name: /New Broadcast/i }).first(),
        ).toBeVisible();

        // Fill subject
        const subjectInput = page
            .locator('input[placeholder="Important update"]')
            .first();
        await expect(subjectInput).toBeVisible();
        await subjectInput.fill('E2E Test Subject');

        // Rich text editor body — find its editable region
        const body = page.locator('[contenteditable="true"]').first();
        if (await body.count()) {
            await body.click();
            await page.keyboard.type('Test body content');
        }

        // Close without sending — click Cancel (the Compose button becomes Cancel)
        await page.getByRole('button', { name: /^Cancel$/i }).first().click();
        await expect(page.getByRole('heading', { name: /New Broadcast/i })).toHaveCount(0);

        // Page still stable
        await expect(heading).toBeVisible();
    });
});
