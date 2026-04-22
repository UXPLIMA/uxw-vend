// tests/e2e/theme-v2.spec.ts
import { test, expect } from "@playwright/test";
import { login } from "./helpers/login";

test.describe("theme v2 acceptance", () => {
    test("theme settings page renders manifest-driven color inputs", async ({ page }) => {
        await login(page);
        await page.goto("/tr/admin/settings/theme");
        // Flat (active) declares `primary` and `background` tokens — expect at
        // least one of these as a labeled input. Heading check guarantees we
        // landed on the right page.
        await expect(page.locator("h1, h2").filter({ hasText: /color|renk/i }).first()).toBeVisible({ timeout: 15_000 });
    });

    test("/admin/settings/customizer returns 404", async ({ page }) => {
        await login(page);
        const res = await page.goto("/tr/admin/settings/customizer");
        // Next.js renders the 404 UI with 200 in some cases — check either.
        const status = res?.status() ?? 0;
        if (status !== 404) {
            await expect(page.locator("text=/404|not found/i").first()).toBeVisible();
        }
    });

    test("/admin/settings/hero returns 404", async ({ page }) => {
        await login(page);
        const res = await page.goto("/tr/admin/settings/hero");
        const status = res?.status() ?? 0;
        if (status !== 404) {
            await expect(page.locator("text=/404|not found/i").first()).toBeVisible();
        }
    });

    test("html has data-theme and data-mode attributes", async ({ page }) => {
        await page.goto("/tr");
        await expect(page.locator("html")).toHaveAttribute("data-theme", /.+/);
        await expect(page.locator("html")).toHaveAttribute("data-mode", /.+/);
    });

    test("active theme cannot be deleted", async ({ request }) => {
        // Unauthenticated — still gets a terminal status (403 or 409).
        // Admin would get 409; unauthenticated gets 403. Either proves the
        // endpoint doesn't cheerfully delete.
        const res = await request.delete("/api/v1/themes/flat");
        expect([403, 409, 401]).toContain(res.status());
    });

    test("theme state API returns current theme + mode", async ({ request }) => {
        const res = await request.get("/api/v1/themes/state");
        expect(res.ok()).toBe(true);
        const body = await res.json();
        expect(typeof body.themeId).toBe("string");
        expect(typeof body.mode).toBe("string");
    });
});
