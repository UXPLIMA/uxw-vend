/**
 * What the admin settings page needs to tell an operator whether Steam login
 * actually works: whether the API key is set, and the exact URL Steam has to
 * be pointed at.
 *
 * The key itself is never returned - only whether it is present. Steam login
 * is configured with an env var rather than a database setting because
 * Auth.js builds its provider list synchronously at startup, long before a
 * database round-trip is possible.
 */
import { NextResponse } from "next/server";
import { isAdmin, resolveAppUrl } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { steamReturnTo } from "../../lib/steam-urls";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const appUrl = resolveAppUrl();
    return NextResponse.json({
        configured: Boolean(process.env.AUTH_STEAM_API_KEY),
        envVar: "AUTH_STEAM_API_KEY",
        realm: appUrl,
        returnTo: steamReturnTo(appUrl),
    });
}
