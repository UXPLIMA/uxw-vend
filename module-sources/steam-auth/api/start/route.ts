/**
 * Step one of Steam sign-in: hand the browser to Steam.
 *
 * The realm and return_to are built from the canonical app URL rather than the
 * incoming request, because Steam signs both and the callback re-checks
 * return_to against the same value. Deriving them from a proxied request host
 * would make the two ends disagree the moment the app sits behind a proxy.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAppUrl, withRateLimit, rateLimits } from "@/core/sdk/server";
import { buildLoginUrl } from "../../lib/steam-openid";
import { steamReturnTo } from "../../lib/steam-urls";

export const GET = withRateLimit(async (_req: NextRequest) => {
    if (!process.env.AUTH_STEAM_API_KEY) {
        return NextResponse.json({ error: "Steam login is not configured" }, { status: 503 });
    }
    const appUrl = resolveAppUrl();
    return NextResponse.redirect(buildLoginUrl(appUrl, steamReturnTo(appUrl)));
}, rateLimits.auth);
