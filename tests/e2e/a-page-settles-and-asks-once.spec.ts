/**
 * A page loads once and then stays where it landed.
 *
 * Two failures live in the same moment, the seconds after the HTML arrives,
 * and neither is visible to any unit test because both are made of network
 * timing and layout.
 *
 * The first is repetition. There is no shared data layer here: every widget
 * runs its own `useEffect` and its own `fetch`, so four store widgets asking
 * for the same totals produced seven requests for `/api/v1/widget-stats`,
 * three for `/api/v1/public-settings` and two for the session. Twelve of the
 * twenty-one requests a homepage made were for bytes it already had in
 * flight. On a local machine that is invisible; from Istanbul to a German
 * host it is twelve extra round trips.
 *
 * The second is movement. The footer and the navigation grow their module
 * contributed links after paint, so the page shipped a cumulative layout
 * shift of 0.211 against a 0.1 budget, with 0.154 of it the footer pushing
 * everything above it upward at 756ms. That is what "it does not load
 * properly" looks like from the other side of the screen.
 *
 * The thresholds are deliberately above what the fix achieves, so this fails
 * on a regression rather than on noise.
 */
import { test, expect } from '@playwright/test';

/** Requests a page may legitimately repeat: navigation and user actions. */
const IGNORED = /\/api\/auth\/(session|csrf|providers)/;

test.describe('a page load', () => {
    test('asks for nothing twice', async ({ page }) => {
        const calls: string[] = [];
        page.on('request', (r) => {
            const u = new URL(r.url());
            if (u.pathname.startsWith('/api/') && !IGNORED.test(u.pathname)) {
                calls.push(u.pathname + u.search);
            }
        });

        await page.goto('/tr', { waitUntil: 'load' });
        await page.waitForTimeout(4000);

        const counts = new Map<string, number>();
        for (const c of calls) counts.set(c, (counts.get(c) ?? 0) + 1);
        const repeated = [...counts.entries()]
            .filter(([, n]) => n > 1)
            .map(([u, n]) => `${n}x ${u}`);

        expect(
            repeated,
            `The same endpoint was fetched more than once in one page load:\n${repeated.join('\n')}`,
        ).toEqual([]);
    });

    test('stays where it landed', async ({ page }) => {
        await page.addInitScript(() => {
            (window as unknown as { __cls: number }).__cls = 0;
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value: number };
                    if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
                }
            }).observe({ type: 'layout-shift', buffered: true });
        });

        await page.goto('/tr', { waitUntil: 'load' });
        await page.waitForTimeout(4000);

        const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
        // Google treats 0.1 as the boundary of a good experience.
        expect(cls, `cumulative layout shift was ${cls.toFixed(3)}`).toBeLessThan(0.1);
    });
});
