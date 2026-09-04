/**
 * Step two of Steam sign-in: check what came back and park it.
 *
 * This route cannot sign anyone in. It is a plain GET reached by a redirect
 * from another site, so it has no CSRF token and Auth.js will not mint a
 * session from it. What it does instead is verify the assertion, store the
 * proven Steam id under a single-use ticket, and send the browser to a page
 * that trades that ticket for a real sign-in.
 *
 * Every failure lands on the login page with a reason rather than a JSON
 * error: the visitor arrived here by clicking a button, not by calling an API.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAppUrl, withRateLimit, rateLimits, log } from "@/core/sdk/server";
import { verifyAssertion } from "../../lib/steam-openid";
import { issueTicket } from "../../lib/steam-ticket";
import { steamReturnTo, steamSignInPath, steamFailurePath } from "../../lib/steam-urls";

export const GET = withRateLimit("steam-callback", async (req: NextRequest) => {
    const appUrl = resolveAppUrl();

    if (!process.env.AUTH_STEAM_API_KEY) {
        return NextResponse.redirect(`${appUrl}${steamFailurePath("SteamNotConfigured")}`);
    }

    let steamId: string | null = null;
    try {
        steamId = await verifyAssertion(req.nextUrl.searchParams, { returnTo: steamReturnTo(appUrl) });
    } catch (error) {
        // Steam being unreachable is an outage, not a rejected login, and it
        // is worth a log line - the visitor only sees a generic failure.
        log.warn("[steam-auth] assertion verification failed", {
            error: error instanceof Error ? error.message : String(error),
        });
    }

    if (!steamId) {
        return NextResponse.redirect(`${appUrl}${steamFailurePath("SteamVerificationFailed")}`);
    }

    const ticket = await issueTicket(steamId);
    return NextResponse.redirect(`${appUrl}${steamSignInPath(ticket)}`);
}, rateLimits.auth);
