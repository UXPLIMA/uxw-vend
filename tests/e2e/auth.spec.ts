import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test('login with valid credentials', async ({ page }) => {
        await page.goto('/en/login');
        await page.fill('input[name="email"], input[type="email"]', 'admin@admin.com');
        await page.fill('input[name="password"], input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');
        // Should redirect away from login page on success
        await page.waitForURL(/(?!.*login).*/, { timeout: 10000 });
        expect(page.url()).not.toContain('/login');
    });

    test('login with invalid credentials shows error', async ({ page }) => {
        await page.goto('/en/login');
        await page.fill('input[name="email"], input[type="email"]', 'wrong@wrong.com');
        await page.fill('input[name="password"], input[type="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');
        // Should stay on login page or show an error
        await page.waitForTimeout(2000);
        const hasError = await page.locator('[role="alert"], .error, .text-red-500, [data-error]').count();
        const stillOnLogin = page.url().includes('/login');
        expect(hasError > 0 || stillOnLogin).toBe(true);
    });

    test('register new account', async ({ page }) => {
        await page.goto('/en/register');
        const timestamp = Date.now();
        await page.fill('input[name="username"], input[name="name"]', `testuser${timestamp}`);
        await page.fill('input[name="email"], input[type="email"]', `test${timestamp}@test.com`);
        await page.fill('input[name="password"], input[type="password"]', 'TestPassword123!');
        // Fill confirm password if it exists
        const confirmPassword = page.locator('input[name="confirmPassword"], input[name="password_confirmation"]');
        if (await confirmPassword.count() > 0) {
            await confirmPassword.fill('TestPassword123!');
        }
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        // Should redirect away from register or show success
        const url = page.url();
        const leftRegister = !url.includes('/register');
        const hasSuccess = await page.locator('[role="alert"], .success, .text-green-500').count() > 0;
        expect(leftRegister || hasSuccess).toBe(true);
    });

    test('profile page accessible when logged in', async ({ page }) => {
        // Login first
        await page.goto('/en/login');
        await page.fill('input[name="email"], input[type="email"]', 'admin@admin.com');
        await page.fill('input[name="password"], input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await page.waitForURL(/(?!.*login).*/, { timeout: 10000 });

        const response = await page.goto('/en/profile');
        expect(response?.status()).toBe(200);
    });

    test('profile page redirects when not logged in', async ({ page }) => {
        await page.goto('/en/profile');
        await page.waitForURL(/login/, { timeout: 10000 });
        expect(page.url()).toContain('login');
    });
});
