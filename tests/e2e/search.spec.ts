import { test, expect } from '@playwright/test';

test.describe('Public search', () => {
    test('returns result groups or a no-results message', async ({ page }) => {
        const response = await page.goto('/tr/search?q=blog');
        expect(response?.status(), 'search HTTP status').toBeLessThan(400);

        // The page auto-runs the search when landing with ?q=. Wait for either
        // a result card or the "no results" fallback card to appear.
        const anyOutcome = page.locator(
            'text=/No results|Sonuç bulunamadı|result[s]?|sonuç/i',
        );
        await expect(anyOutcome.first()).toBeVisible({ timeout: 15_000 });
    });
});
