import type { Page } from '@playwright/test';

/**
 * Default credentials for the seeded admin user.
 * The login form uses the email field as the identifier.
 */
export const ADMIN_EMAIL = 'admin@uxwvend.com';
export const ADMIN_USERNAME = 'admin';
export const ADMIN_PASSWORD = 'admin123';

/**
 * Logs a user in via the /tr/auth/login page.
 *
 * The `username` parameter is accepted for API compatibility — if it looks
 * like an email it's used as-is, otherwise the default admin email is used
 * (the login form is email-based in this project).
 */
export async function login(
    page: Page,
    username: string = ADMIN_USERNAME,
    password: string = ADMIN_PASSWORD,
): Promise<void> {
    const email = username.includes('@') ? username : ADMIN_EMAIL;

    await page.goto('/tr/auth/login');
    await page.locator('input#email, input[type="email"]').first().fill(email);
    await page.locator('input#password, input[type="password"]').first().fill(password);

    await Promise.all([
        page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15_000 }),
        page.locator('button[type="submit"]').first().click(),
    ]);
}
