import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

// Public settings keys that can be read without authentication
// Only core platform keys — module-specific settings should be served by each module's own API
const PUBLIC_KEYS = [
    "site_name",
    "site_description",
    "site_email",
    "footer_text",
    "custom_css",
    "navbar_links",
    "theme_color_primary",
    "theme_color_secondary",
    "theme_color_accent",
    "currency",
    "currency_symbol",
];

// GET /api/v1/public-settings
export async function GET() {
    const settings = await prisma.setting.findMany({
        where: { key: { in: PUBLIC_KEYS } },
    });

    const settingsMap: Record<string, unknown> = {};
    for (const s of settings) {
        settingsMap[s.key] = s.value;
    }

    return NextResponse.json({ settings: settingsMap }, {
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
}
