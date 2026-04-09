/**
 * Manual mobile-audit script.
 *
 * Visits a set of admin + public pages at 375x667, takes screenshots,
 * and reports horizontal overflow, tiny tap targets, and tables without
 * a horizontal scroll wrapper.
 *
 * Not a committed test. Run with:
 *   npx tsx tests/manual/mobile-audit.ts [outDir]
 */
import { chromium, Page } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "http://127.0.0.1:3001";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@uxwvend.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin123!";

type PageSpec = { path: string; requiresAuth: boolean; label: string };

const PAGES: PageSpec[] = [
    { path: "/", requiresAuth: false, label: "home" },
    { path: "/auth/login", requiresAuth: false, label: "login" },
    { path: "/profile", requiresAuth: true, label: "profile" },
    { path: "/admin", requiresAuth: true, label: "admin-dashboard" },
    { path: "/admin/users", requiresAuth: true, label: "admin-users" },
    { path: "/admin/audit-log", requiresAuth: true, label: "admin-audit-log" },
    { path: "/admin/ip-blocks", requiresAuth: true, label: "admin-ip-blocks" },
    { path: "/admin/trophies", requiresAuth: true, label: "admin-trophies" },
    { path: "/admin/settings", requiresAuth: true, label: "admin-settings" },
    { path: "/admin/modules", requiresAuth: true, label: "admin-modules" },
];

async function dismissCookieBanner(page: Page) {
    const banner = page.locator('text=/we use cookies/i').first();
    if (await banner.count()) {
        const accept = page.locator('button', { hasText: /accept|ok|got it/i }).first();
        if (await accept.count()) await accept.click().catch(() => {});
    }
}

async function login(page: Page) {
    try {
        await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    } catch {
        return;
    }
    await dismissCookieBanner(page);
    const email = page.locator('input[type="email"], input[name="email"]').first();
    const pw = page.locator('input[type="password"]').first();
    if (await email.count()) {
        await email.fill(ADMIN_EMAIL);
        await pw.fill(ADMIN_PASSWORD);
        const submit = page.locator('button[type="submit"]').first();
        await submit.click();
        await page.waitForURL((u) => !u.pathname.includes("/auth/login"), { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(500);
    }
}

async function audit(page: Page, spec: PageSpec, outDir: string) {
    const url = `${BASE}${spec.path}`;
    try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
        await page.waitForTimeout(2500);
        await dismissCookieBanner(page);
        // Wait for any hydration; scroll to bottom to trigger lazy-loaded images
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, 0));
    } catch {
        return { label: spec.label, error: "navigation-timeout", issues: [] };
    }

    // Check horizontal overflow
    const result = await page.evaluate(() => {
        const issues: string[] = [];
        const docW = document.documentElement.clientWidth;
        const scrollW = document.documentElement.scrollWidth;
        if (scrollW > docW + 2) {
            issues.push(`horizontal-overflow: scrollW=${scrollW} > clientW=${docW}`);
            // Identify culprit elements
            const all = Array.from(document.querySelectorAll("*")) as HTMLElement[];
            const culprits: string[] = [];
            for (const el of all) {
                const rect = el.getBoundingClientRect();
                if (rect.right > docW + 2 && rect.width > 100) {
                    const tag = el.tagName.toLowerCase();
                    const cls = (el.className || "").toString().slice(0, 60);
                    culprits.push(`${tag}.${cls} w=${Math.round(rect.width)} right=${Math.round(rect.right)}`);
                    if (culprits.length >= 3) break;
                }
            }
            for (const c of culprits) issues.push(`  culprit: ${c}`);
        }
        // Find tables without overflow wrapper
        const tables = Array.from(document.querySelectorAll("table"));
        tables.forEach((t, i) => {
            const parent = t.parentElement;
            if (!parent) return;
            const cs = getComputedStyle(parent);
            if (cs.overflowX !== "auto" && cs.overflowX !== "scroll") {
                const rect = t.getBoundingClientRect();
                if (rect.width > docW) {
                    issues.push(`table[${i}] overflows without wrapper: w=${Math.round(rect.width)}`);
                }
            }
        });
        // Tap targets
        const targets = Array.from(document.querySelectorAll("button, a[href]"));
        let smallCount = 0;
        for (const el of targets) {
            const rect = (el as HTMLElement).getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && (rect.width < 32 || rect.height < 32)) {
                smallCount++;
            }
        }
        if (smallCount > 0) {
            issues.push(`tap-targets-small: ${smallCount} interactive elements < 32px`);
        }
        return { issues };
    });

    const file = resolve(outDir, `${spec.label}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});

    return { label: spec.label, ...result };
}

async function main() {
    const outDir = process.argv[2] || "/tmp/mobile-before";
    mkdirSync(outDir, { recursive: true });

    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
        userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    });
    // Preload localStorage to suppress cookie banner
    await context.addInitScript(() => {
        try { localStorage.setItem("cookie_consent", "accepted"); } catch {}
    });
    const page = await context.newPage();

    await login(page);

    // Verify auth worked by visiting /admin
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(1500);
    console.log(`After login URL: ${page.url()}`);

    const results = [];
    for (const spec of PAGES) {
        const r = await audit(page, spec, outDir);
        results.push(r);
        const status = r.issues.length === 0 ? "OK" : `${r.issues.length} issue(s)`;
        console.log(`[${r.label}] ${status}`);
        for (const i of r.issues) console.log(`  - ${i}`);
    }

    await browser.close();

    const totalIssues = results.reduce((acc, r) => acc + r.issues.length, 0);
    console.log(`\nTotal issues: ${totalIssues}`);
    console.log(`Screenshots in: ${outDir}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
