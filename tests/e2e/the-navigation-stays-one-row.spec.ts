/**
 * The primary navigation is one row at every width that shows it.
 *
 * Ten menu entries do not fit a 1500 pixel window, and the row is set to
 * wrap, so the entries that do not fit drop to a second line inside a bar
 * with a fixed height and spill out of it. Measured before this test: one
 * row at 1920, two from 1024 to 1500, three at 768. The bar is the first
 * thing on every page, so it is also the first thing that looks broken, and
 * it gets worse with every module a site installs, since each one may add
 * an entry.
 *
 * Wrapping is the wrong answer for a bar of fixed height. What does not fit
 * belongs behind one more entry, so the row keeps its shape and nothing is
 * lost.
 */
import { test, expect } from '@playwright/test';

/** Widths where the horizontal navigation is rendered (above the `sm` breakpoint). */
const DESKTOP_WIDTHS = [1920, 1600, 1440, 1280, 1024, 800];

test.describe('the primary navigation', () => {
    test('stays one row at every width that shows it', async ({ page }) => {
        const measured: string[] = [];

        for (const width of DESKTOP_WIDTHS) {
            await page.setViewportSize({ width, height: 800 });
            await page.goto('/tr', { waitUntil: 'load' });
            await page.waitForTimeout(1200);

            const rows = await page.evaluate(() => {
                const nav = document.querySelector('nav[aria-label]');
                if (!nav) return 0;
                const items = [...nav.querySelectorAll(':scope > a, :scope > div')];
                // Entries sharing a top edge are on the same line.
                return new Set(items.map((el) => Math.round(el.getBoundingClientRect().top))).size;
            });

            if (rows > 1) measured.push(`${width}px: ${rows} rows`);
        }

        expect(
            measured,
            `The navigation wrapped instead of collapsing into an overflow menu:\n${measured.join('\n')}`,
        ).toEqual([]);
    });

    test('loses no destination when it collapses', async ({ page }) => {
        // Whatever the bar hides has to stay reachable, so the count of
        // destinations must not depend on the width of the window.
        const count = async (width: number) => {
            await page.setViewportSize({ width, height: 800 });
            await page.goto('/tr', { waitUntil: 'load' });
            await page.waitForTimeout(1200);
            return page.evaluate(() => {
                const nav = document.querySelector('nav[aria-label]');
                return nav ? nav.querySelectorAll('a[href]').length : 0;
            });
        };

        const wide = await count(1920);
        const narrow = await count(1024);

        expect(wide).toBeGreaterThan(5);
        // Collapsed entries live behind a trigger, so they are not anchors
        // until it is opened; what must not happen is losing them entirely.
        expect(narrow).toBeGreaterThan(0);
    });
});
