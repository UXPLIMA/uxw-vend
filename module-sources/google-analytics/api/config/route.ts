import { NextResponse } from "next/server";
import { prisma } from "@/core/sdk/server";

/**
 * GET /api/v1/google-analytics/config
 *
 * Public: every visitor's browser needs the measurement ID before it can load
 * gtag, so there is nothing to authenticate. The module serves it itself
 * rather than asking core to publish the key - `/api/v1/public-settings`
 * carries core's own settings, and a module that needs a public value exposes
 * it through its own API. This one used to read the key from there, where it
 * was never published, so the ID an admin typed in went nowhere and no page
 * was ever tracked.
 *
 * Cached for 60s: this is fetched on every page load.
 */
const SETTING_ID = "google_analytics_id";
const SETTING_ENABLED = "enable_analytics";

let cache: { measurementId: string; enabled: boolean; expiresAt: number } | null = null;

export async function GET() {
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
        return NextResponse.json({ measurementId: cache.measurementId, enabled: cache.enabled });
    }

    const rows = await prisma.setting
        .findMany({ where: { key: { in: [SETTING_ID, SETTING_ENABLED] } } })
        .catch(() => []);

    const values = new Map(rows.map((row) => [row.key, row.value]));
    const rawId = values.get(SETTING_ID);
    const measurementId = typeof rawId === "string" ? rawId.trim() : "";

    // The setting is stored as text, so "true" and true both mean on. Absent
    // means on as well: an admin who filled in a measurement ID and never
    // touched the second field meant to be tracking.
    const rawEnabled = values.get(SETTING_ENABLED);
    const enabled = rawEnabled === undefined || rawEnabled === null || rawEnabled === ""
        ? true
        : rawEnabled === true || String(rawEnabled).toLowerCase() === "true";

    cache = { measurementId, enabled, expiresAt: now + 60_000 };
    return NextResponse.json({ measurementId, enabled });
}
