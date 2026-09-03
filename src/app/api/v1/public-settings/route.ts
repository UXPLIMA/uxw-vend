import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import { cached } from "@/core/lib/cache";
import { SETTINGS_CACHE, getDurationMs } from "@/core/lib/security-settings";

// Public settings keys that can be read without authentication.
// Only core platform keys - module-specific settings (Discord widget IDs,
// hero text, server IPs, etc.) live in their own module's public API.
// Themes that need extra public values use the theme.json schema-driven
// settings system (read via useThemeConfig, not from here).
const PUBLIC_KEYS = [
    "site_name",
    "site_description",
    "site_email",
    "site_discord_url",
    // Rendered by the footer. Core no longer hardcodes a legal column, so an
    // install's legal links live entirely in these two settings.
    "footer_about_text",
    "footer_quick_links",
    "footer_legal_links",
    "footer_copyright",
    "custom_css",
    "navbar_links",
    "theme_color_primary",
    "theme_color_secondary",
    "theme_color_accent",
    "currency",
    "currency_symbol",
    // Theme customizer overrides
    "theme_overrides",
];

const PUBLIC_SETTINGS_CACHE_KEY = "public-settings";

// GET /api/v1/public-settings
export async function GET() {
    // How long this response may be reused - admin-configurable, clamped.
    const ttlMs = await getDurationMs(SETTINGS_CACHE);

    const settingsMap = await cached<Record<string, unknown>>(
        PUBLIC_SETTINGS_CACHE_KEY,
        ttlMs,
        async () => {
            const rows = await prisma.setting.findMany({
                where: { key: { in: PUBLIC_KEYS } },
            });
            const map: Record<string, unknown> = {};
            for (const s of rows) {
                map[s.key] = s.value;
            }
            return map;
        },
    );

    return NextResponse.json({
        settings: settingsMap,
        // The browser reuses the payload for this long; see useSiteSettings.
        cacheSeconds: Math.floor(ttlMs / 1000),
        // Exposed so the login page can show its credentials banner on the
        // demo instance without baking the flag into client code.
        isDemo: process.env.DEMO_MODE === "1",
    }, {
        headers: {
            "Cache-Control": `public, s-maxage=${Math.floor(ttlMs / 2000)}, stale-while-revalidate=${Math.floor(ttlMs / 1000)}`,
        },
    });
}
