import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

// GET /api/v1/discord-widget — Public: returns the configured Discord server ID
// for the homepage widget iframe. Anyone visiting the public homepage needs this,
// so no auth is required. Cached for 60s.
let cache: { serverId: string; expiresAt: number } | null = null;

export async function GET() {
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
        return NextResponse.json({ serverId: cache.serverId });
    }

    const setting = await prisma.setting.findUnique({
        where: { key: "widget_discord_server_id" },
    }).catch(() => null);

    const raw = setting?.value;
    const serverId = typeof raw === "string" ? raw : "";
    cache = { serverId, expiresAt: now + 60_000 };
    return NextResponse.json({ serverId });
}
