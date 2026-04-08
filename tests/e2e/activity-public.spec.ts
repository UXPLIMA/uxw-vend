import { test, expect } from '@playwright/test';

test.describe('Public activity feed', () => {
    test('renders activity page without login', async ({ page }) => {
        const response = await page.goto('/en/activity');
        expect(response?.status(), 'activity HTTP status').toBeLessThan(400);

        const heading = page
            .getByRole('heading', { name: /Activity Feed|Activity/i })
            .first();
        await expect(heading).toBeVisible();

        // Either feed items or empty state should be present
        const empty = page.getByText(/No recent activity yet/i);
        const feedItems = page.locator('main .space-y-2 > *').first();
        await expect(empty.or(feedItems)).toBeVisible();
    });
});
