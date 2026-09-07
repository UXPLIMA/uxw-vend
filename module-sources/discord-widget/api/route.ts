import { NextResponse } from "next/server";
import { prisma } from "@/core/sdk/server";

/**
 * This answer is the same whoever asked, so a proxy in front of the site may
 * hold it briefly. `s-maxage` speaks to shared caches and not to browsers, so
 * no visitor's own cache is involved. Anything here that ever starts varying
 * by who is asking has to lose this.
 */
const SHARED_CACHE = { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" };

// GET /api/v1/discord-widget - Public: returns the configured Discord server ID
// for the homepage widget iframe. Anyone visiting the public homepage needs this,
// so no auth is required. Cached for 60s.
let cache: { serverId: string; expiresAt: number } | null = null;

export async function GET() {
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
        return NextResponse.json({ serverId: cache.serverId }, { headers: SHARED_CACHE });
    }

    const setting = await prisma.setting.findUnique({
        where: { key: "widget_discord_server_id" },
    }).catch(() => null);

    const raw = setting?.value;
    const serverId = typeof raw === "string" ? raw : "";
    cache = { serverId, expiresAt: now + 60_000 };
    return NextResponse.json({ serverId }, { headers: SHARED_CACHE });
}
