import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, login } from './helpers/login';

test.describe('Authentication', () => {
    test('login with valid credentials', async ({ page }) => {
        await page.goto('/en/auth/login');
        await page.locator('input#email, input[type="email"]').first().fill(ADMIN_EMAIL);
        await page.locator('input#password, input[type="password"]').first().fill(ADMIN_PASSWORD);
        await page.locator('button[type="submit"]').first().click();
        // Should redirect away from login page on success
        await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15_000 });
        expect(page.url()).not.toContain('/auth/login');
    });

    test('login with invalid credentials shows error', async ({ page }) => {
        await page.goto('/en/auth/login');
        await page.locator('input#email, input[type="email"]').first().fill('wrong@wrong.com');
        await page.locator('input#password, input[type="password"]').first().fill('wrongpassword');
        await page.locator('button[type="submit"]').first().click();
        // Should stay on login page or show an error
        await page.waitForTimeout(2000);
        const hasError = await page.locator('[role="alert"], .error, .text-red-500, [data-error]').count();
        const stillOnLogin = page.url().includes('/auth/login');
        expect(hasError > 0 || stillOnLogin).toBe(true);
    });

    test('register new account', async ({ page }) => {
        await page.goto('/en/auth/register');
        const timestamp = Date.now();
        // Register form has explicit name attributes: email, username, password, confirmPassword
        await page.locator('input[name="username"]').fill(`testuser${timestamp}`);
        await page.locator('input[name="email"]').fill(`test${timestamp}@test.com`);
        await page.locator('input[name="password"]').fill('TestPassword123!');
        const confirmPassword = page.locator('input[name="confirmPassword"]');
        if (await confirmPassword.count() > 0) {
            await confirmPassword.fill('TestPassword123!');
        }
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(3000);
        // Should redirect away from register or show success
        const url = page.url();
        const leftRegister = !url.includes('/auth/register');
        const hasSuccess = await page.locator('[role="alert"], .success, .text-green-500').count() > 0;
        expect(leftRegister || hasSuccess).toBe(true);
    });

    test('profile page accessible when logged in', async ({ page }) => {
        // Login first via helper
        await login(page);

        const response = await page.goto('/tr/profile');
        expect(response?.status()).toBeLessThan(400);
    });

    test('profile page redirects when not logged in', async ({ page }) => {
        await page.goto('/en/profile');
        // Profile is a client component that redirects via router; wait for URL change
        await page.waitForURL(/auth\/login|\/login/, { timeout: 15_000 });
        expect(page.url()).toContain('login');
    });
});
