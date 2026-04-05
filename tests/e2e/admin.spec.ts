import { test, expect } from '@playwright/test';

test.describe('Admin Panel', () => {
    // Helper: log in as admin before each test
    test.beforeEach(async ({ page }) => {
        await page.goto('/en/login');
        await page.fill('input[name="email"], input[type="email"]', 'admin@admin.com');
        await page.fill('input[name="password"], input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');
        // Wait for redirect away from login
        await page.waitForURL(/(?!.*login).*/, { timeout: 10000 });
    });

    test('admin dashboard loads', async ({ page }) => {
        const response = await page.goto('/en/admin');
        expect(response?.status()).toBe(200);
        await expect(page.locator('body')).toBeVisible();
    });

    test('modules page loads', async ({ page }) => {
        const response = await page.goto('/en/admin/modules');
        expect(response?.status()).toBe(200);
    });

    test('settings page loads', async ({ page }) => {
        const response = await page.goto('/en/admin/settings');
        expect(response?.status()).toBe(200);
    });

    test('users page loads', async ({ page }) => {
        const response = await page.goto('/en/admin/users');
        expect(response?.status()).toBe(200);
    });

    test('roles page loads', async ({ page }) => {
        const response = await page.goto('/en/admin/roles');
        expect(response?.status()).toBe(200);
    });
});
