/**
 * A page that is waiting is already the size of its answer.
 *
 * Both of these screens draw a placeholder while they wait and then replace
 * it, and neither placeholder was drawn to the shape of what replaced it.
 * Measured at 1280px over a production build: the cart drew a bare 128px box
 * around a spinner and answered with a 300px card, and the forum drew a 120px
 * line of text and answered with a 236px card. The footer and everything
 * above it moved down by the difference, which was 0.0716 of layout shift on
 * the cart and 0.0398 on the forum, on top of a budget of 0.1 that the rest
 * of the page has already spent some of.
 *
 * The answer is held back here until the rest of the page has stopped moving,
 * so what this measures is that one screen and not the page around it. Page
 * length is used rather than a selector because the height is the thing under
 * test and the markup is not.
 */
import { test, expect, type Page } from '@playwright/test';

/** Long enough that the rest of the page has finished moving first. */
const HOLD_MS = 3000;

/** Room for the rest of the page to stop moving, before and after. */
const SETTLE_MS = 1000;

/**
 * Loads a page with one answer held back, and reports the page length either
 * side of the moment it arrives.
 */
async function movementWhenTheAnswerArrives(
    page: Page,
    url: string,
    endpoint: string,
    body: unknown,
): Promise<{ before: number; after: number }> {
    let release: () => void = () => {};
    const released = new Promise<void>((resolve) => { release = resolve; });

    await page.route(endpoint, async (route) => {
        await new Promise((r) => setTimeout(r, HOLD_MS));
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body),
        });
        release();
    });

    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(SETTLE_MS);
    const before = await page.evaluate(() => document.body.scrollHeight);

    await released;
    await page.waitForTimeout(SETTLE_MS);
    const after = await page.evaluate(() => document.body.scrollHeight);
    return { before, after };
}

test.describe('a page that is waiting', () => {
    test('is the size of an empty cart before the cart arrives', async ({ page }) => {
        const { before, after } = await movementWhenTheAnswerArrives(
            page,
            '/tr/store/cart',
            '**/api/v1/store/cart**',
            { items: [], total: 0 },
        );
        expect(
            after - before,
            `the cart's answer changed the page length by ${after - before}px (${before} to ${after})`,
        ).toBe(0);
    });

    test('is the size of an empty topic list before the topics arrive', async ({ page }) => {
        const { before, after } = await movementWhenTheAnswerArrives(
            page,
            '/tr/forum',
            '**/api/v1/forum/topics**',
            { topics: [], totalPages: 1, page: 1 },
        );
        expect(
            after - before,
            `the topics changed the page length by ${after - before}px (${before} to ${after})`,
        ).toBe(0);
    });
});
