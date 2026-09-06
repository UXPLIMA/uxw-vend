/**
 * A screen shows copy, never the name of the copy.
 *
 * next-intl does not throw on a missing message: it logs and returns the key
 * path, so a heading renders "news.title" where the title belongs. Seventeen
 * unit gates already hold the catalogues honest, and every one of them reads
 * source and manifests. None of them asks the only question a visitor cares
 * about, which is whether the key resolves when the app is actually running.
 *
 * That gap is not theoretical. Translations are filtered by
 * `getEnabledModuleIds()`, so a module whose files are on disk and whose
 * manifest is complete still renders raw keys until a `ModuleConfig` row says
 * it is enabled. The manifest is right, the unit suite is green, and the
 * homepage says "news.title".
 *
 * Console capture alone does not catch it either. A development build logs
 * MISSING_MESSAGE loudly, and a production build, which is what CI serves,
 * does not. So the page's own visible text is the evidence: anything shaped
 * like `<namespace>.<key>`, where the namespace is one core or a module
 * actually declares, is a key that escaped onto the screen.
 */
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../..');

/**
 * Namespaces read from the sources rather than the database, so the gate
 * describes what the product declares and does not inherit the state of
 * whatever database it happens to run against.
 */
function knownNamespaces(): string[] {
    const names = new Set<string>();

    const core = JSON.parse(readFileSync(join(ROOT, 'messages-core/en.json'), 'utf8'));
    for (const ns of Object.keys(core)) names.add(ns);

    const dir = join(ROOT, 'module-sources');
    for (const id of readdirSync(dir)) {
        const manifest = join(dir, id, 'module.json');
        if (!existsSync(manifest)) continue;
        const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as {
            translations?: Record<string, Record<string, unknown>>;
        };
        for (const byLocale of Object.values(parsed.translations ?? {})) {
            for (const ns of Object.keys(byLocale)) names.add(ns);
        }
    }
    return [...names].sort();
}

const NAMESPACES = knownNamespaces();

/**
 * `common.save`, but not `uxwvend.com` or `0.2.1`. Anchored on a namespace the
 * product declares, which is what keeps a domain name or a filename out.
 */
const KEY_PATTERN = new RegExp(
    String.raw`\b(?:${NAMESPACES.join('|')})\.[a-zA-Z][a-zA-Z0-9_]{2,}\b`,
    'g',
);

/** A missing message is worth failing on wherever the runtime does report it. */
const MISSING_MESSAGE = /MISSING_MESSAGE|Could not resolve/i;

async function visibleKeys(page: import('@playwright/test').Page): Promise<string[]> {
    const text = await page.locator('body').innerText();
    return [...new Set(text.match(KEY_PATTERN) ?? [])];
}

test.describe('translation keys never reach the page', () => {
    test('the gate knows what a namespace is', () => {
        // A regex built from an empty list matches everything or nothing, and
        // either way says nothing about the product.
        expect(NAMESPACES.length).toBeGreaterThan(50);
        expect(NAMESPACES).toContain('common');
    });

    for (const locale of ['tr', 'en']) {
        test(`no screen in ${locale} renders a key`, async ({ page }) => {
            const missing: string[] = [];
            page.on('console', (msg) => {
                if (MISSING_MESSAGE.test(msg.text())) missing.push(msg.text());
            });

            // `networkidle` is not a safe wait here: a session refresh or a widget
            // poll keeps the connection busy, so it times out on a healthy page.
            await page.goto(`/${locale}`, { waitUntil: 'load' });
            await page.waitForTimeout(1500);

            // Walk what the navigation actually offers, so a module that adds
            // a page is covered the day it adds one.
            const hrefs = await page
                .locator(`nav a[href^="/${locale}"], header a[href^="/${locale}"]`)
                .evaluateAll((links) =>
                    [...new Set(links.map((l) => (l as HTMLAnchorElement).getAttribute('href') ?? ''))],
                );

            const paths = [`/${locale}`, ...hrefs.filter(Boolean)].slice(0, 15);
            const offenders: string[] = [];

            for (const path of paths) {
                await page.goto(path, { waitUntil: 'load' });
                await page.waitForTimeout(1200);
                const keys = await visibleKeys(page);
                if (keys.length) offenders.push(`${path}: ${keys.join(', ')}`);
            }

            expect(
                offenders,
                `These screens render a translation key instead of its copy:\n${offenders.join('\n')}`,
            ).toEqual([]);

            expect(
                missing,
                `The runtime reported missing messages:\n${missing.join('\n')}`,
            ).toEqual([]);
        });
    }
});
