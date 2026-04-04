import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

// Public settings keys that can be read without authentication
const PUBLIC_KEYS = [
    "navbar_links",
    "hero_background_image",
    "hero_logo_image",
    "hero_server_ip",
    "hero_discord_url",
    "hero_height",
    "announcement_enabled",
    "announcement_text",
    "announcement_type",
    "announcement_dismissible",
    "custom_css",
    "site_name",
    "site_description",
    "site_email",
    "footer_text",
    "widget_discord_enabled",
    "widget_discord_server_id",
    "widget_recent_purchases_enabled",
    "widget_top_buyers_enabled",
    "widget_stats_enabled",
    "theme_color_primary",
    "theme_color_secondary",
    "theme_color_accent",
    "currency",
    "currency_symbol",
    "google_analytics_id",
    "live_purchase_toast",
    "per_page_products",
    "per_page_blog",
    "per_page_forum",
    "per_page_leaderboard",
    "per_page_home_news",
    "slider_interval",
    "wheel_enabled",
    "wheel_spin_cooldown_hours",
    "wheel_spin_cost_credits",
    "wheel_max_daily_spins",
    "vote_enabled",
    "vote_cooldown_hours",
    "vote_reward_multiplier",
    "widget_refresh_seconds",
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
