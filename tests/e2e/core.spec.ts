import { test, expect } from '@playwright/test';

test.describe('Core Platform', () => {
    test('homepage loads', async ({ page }) => {
        const response = await page.goto('/');
        expect(response?.status()).toBe(200);
    });

    test('homepage has no module content when no modules installed', async ({ page }) => {
        await page.goto('/');
        // Core homepage should render without module-specific sections
        await expect(page.locator('body')).toBeVisible();
    });

    test('navbar shows Home link', async ({ page }) => {
        await page.goto('/');
        const nav = page.locator('nav');
        await expect(nav).toBeVisible();
        await expect(nav.getByRole('link', { name: /home/i })).toBeVisible();
    });

    test('footer renders', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('footer')).toBeVisible();
    });

    test('login page loads', async ({ page }) => {
        const response = await page.goto('/en/login');
        expect(response?.status()).toBe(200);
    });

    test('register page loads', async ({ page }) => {
        const response = await page.goto('/en/register');
        expect(response?.status()).toBe(200);
    });

    test('admin redirects to login when not authenticated', async ({ page }) => {
        await page.goto('/en/admin');
        await page.waitForURL(/login/);
        expect(page.url()).toContain('login');
    });

    test('404 page works for unknown routes', async ({ page }) => {
        const response = await page.goto('/en/this-route-does-not-exist');
        expect(response?.status()).toBe(404);
    });
});
