import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers/login';

test.describe('Admin login flow', () => {
    test('fills credentials and redirects away from login', async ({ page }) => {
        await page.goto('/tr/auth/login');

        await page.locator('input#email, input[type="email"]').first().fill(ADMIN_EMAIL);
        await page.locator('input#password, input[type="password"]').first().fill(ADMIN_PASSWORD);

        await page.locator('button[type="submit"]').first().click();

        await page.waitForURL(
            (url) => !url.pathname.includes('/auth/login'),
            { timeout: 15_000 },
        );

        expect(page.url()).not.toContain('/auth/login');
    });
});
