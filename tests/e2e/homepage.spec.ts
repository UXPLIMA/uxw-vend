import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
    test('renders hero banner and footer without console errors', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });
        page.on('pageerror', (err) => {
            consoleErrors.push(err.message);
        });

        const response = await page.goto('/tr', { waitUntil: 'domcontentloaded' });
        expect(response?.status(), 'homepage HTTP status').toBeLessThan(400);

        // Footer is always present
        await expect(page.locator('footer').first()).toBeVisible();

        // Hero banner / main landmark should render
        const mainOrHero = page
            .locator('main, [data-hero], section[class*="hero" i], [class*="HeroBanner" i]')
            .first();
        await expect(mainOrHero).toBeVisible();

        // Allow minor, noisy warnings to slip through but fail on hard errors
        // such as hydration mismatches or uncaught exceptions.
        const hardErrors = consoleErrors.filter((e) => {
            const lower = e.toLowerCase();
            return (
                !lower.includes('favicon') &&
                !lower.includes('manifest') &&
                !lower.includes('downloadable font') &&
                !lower.includes('third-party cookie')
            );
        });
        expect(hardErrors, `unexpected console errors:\n${hardErrors.join('\n')}`).toEqual([]);
    });
});
