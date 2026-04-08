import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Admin Panel', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('admin dashboard loads', async ({ page }) => {
        const response = await page.goto('/tr/admin');
        expect(response?.status()).toBeLessThan(400);
        await expect(page.locator('body')).toBeVisible();
    });

    test('modules page loads', async ({ page }) => {
        const response = await page.goto('/tr/admin/modules');
        expect(response?.status()).toBeLessThan(400);
    });

    test('settings page loads', async ({ page }) => {
        const response = await page.goto('/tr/admin/settings');
        expect(response?.status()).toBeLessThan(400);
    });

    test('users page loads', async ({ page }) => {
        const response = await page.goto('/tr/admin/users');
        expect(response?.status()).toBeLessThan(400);
    });

    test('roles page loads', async ({ page }) => {
        const response = await page.goto('/tr/admin/roles');
        expect(response?.status()).toBeLessThan(400);
    });
});
