/**
 * A section that reserves room keeps it.
 *
 * The news section says it is waiting while it waits for
 * `/api/v1/blog/articles`, and the room it holds is a minimum height. A
 * minimum is a floor, not a size, and here it was a floor nobody stood on.
 * Measured at 1280px, the same section rendered three different heights:
 * 580px while loading, 532px when the answer was empty, 632px when four
 * articles arrived. The reservation was 532px, which matched neither of the
 * states that actually reach a reader.
 *
 * The difference is the heading. The settled section draws an `h2` above the
 * grid and the skeleton does not, so the skeleton stood in for a shape the
 * page never renders, and the answer arriving moved the footer and
 * everything under it by 48px or 52px depending on whether there was
 * anything to show.
 *
 * The page wide budget in `a-page-settles-and-asks-once.spec.ts` cannot see
 * this. It sums every source of movement at once and this section answers
 * quickly enough to hide inside the rest of the page settling. So this test
 * holds the answer back until everything else has stopped, then asks whether
 * the page is still the same length once it arrives. Page length is used
 * rather than a selector because the height is the thing under test and the
 * markup is not: no test hook is added to the component for this.
 */
import { test, expect } from '@playwright/test';

/** Long enough that the rest of the page has finished moving first. */
const HOLD_MS = 4000;

/** Room for the rest of the page to stop moving, once the skeleton is up. */
const SETTLE_MS = 1000;

/** One article in the shape `/api/v1/blog/articles` returns. */
const article = (n: number) => ({
    id: n,
    number: n,
    slug: `article-${n}`,
    title: `A headline of an ordinary length ${n}`,
    excerpt: 'A summary of the kind an editor writes, a line or so long.',
    coverImage: null,
    publishedAt: '2026-01-02T10:00:00.000Z',
    createdAt: '2026-01-01T10:00:00.000Z',
    category: { name: 'General', slug: 'general' },
});

/**
 * Loads the homepage with the news answer held back, and reports how much
 * the page grew or shrank at the moment it arrived.
 */
async function pageMovementWhenNewsArrives(
    page: import('@playwright/test').Page,
    articles: ReturnType<typeof article>[],
): Promise<{ before: number; after: number }> {
    await page.route('**/api/v1/blog/articles**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ articles }),
        });
    });

    await page.goto('/tr', { waitUntil: 'load' });

    // Waiting for the waiting region rather than for a stopwatch. A fixed
    // delay reads the page before it is up on a slow machine, and a section
    // that never said it was waiting would pass by having nothing to say.
    // `aria-busy` is what says it now; it used to be a pulsing grey block.
    const waiting = page.locator('[aria-busy="true"]').first();
    await waiting.waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForTimeout(SETTLE_MS);
    const before = await page.evaluate(() => document.body.scrollHeight);

    await waiting.waitFor({ state: 'detached', timeout: 20_000 });
    await page.waitForTimeout(SETTLE_MS);
    const after = await page.evaluate(() => document.body.scrollHeight);
    return { before, after };
}

test.describe('the news section', () => {
    test('is the same height whether or not it has articles to show', async ({ page }) => {
        const { before, after } = await pageMovementWhenNewsArrives(page, []);
        expect(
            after - before,
            `an empty answer changed the page length by ${after - before}px (${before} to ${after})`,
        ).toBe(0);
    });

    test('is the same height once its articles arrive', async ({ page }) => {
        const { before, after } = await pageMovementWhenNewsArrives(page, [1, 2, 3, 4].map(article));
        expect(
            after - before,
            `four articles changed the page length by ${after - before}px (${before} to ${after})`,
        ).toBe(0);
    });
});
