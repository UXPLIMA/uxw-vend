import { NextResponse } from "next/server";
import { configuredProviderIds } from "@/core/lib/auth-providers";
import { ModuleAuthDeclarations } from "@/core/generated/module-auth-declarations";
import { getClientIP, rateLimit } from "@/core/lib/rate-limit";
import { getModuleStates } from "@/core/lib/module-cache";
import { isEnabledIn } from "@/core/lib/module-enabled";

/**
 * Which sign-in providers this install can actually use.
 *
 * Installing a provider module puts its button on the login page; whether it
 * works is a different question. Auth.js builds its configuration
 * synchronously at module load, so a provider whose credentials are not in the
 * environment is never built, and its button leads to an error page. This is
 * how the page finds out, and it answers with ids only - the question is which
 * providers exist, never what they are configured with.
 *
 * Two questions, both of which have to be yes: is the provider's module
 * switched on, and are its credentials there. The resolver that builds the
 * providers cannot ask the first one - Auth.js builds its configuration before
 * a database round trip is possible - so a disabled module's provider still
 * exists inside Auth.js. What the panel should *offer* is the narrower answer,
 * and that is what this returns.
 *
 * Public because the login page is, and rate limited for the same reason.
 */
export async function GET(request: Request) {
    const allowed = await rateLimit(`auth-providers:${getClientIP(request.headers)}`, {
        maxRequests: 60,
        windowMs: 60_000,
    });
    if (!allowed.success) {
        return NextResponse.json({ error: "Too many requests", code: "rate_limited" }, { status: 429 });
    }

    let states: Record<string, boolean> = {};
    try {
        states = await getModuleStates();
    } catch {
        // A database that cannot answer is not a reason to offer a provider
        // an operator may have switched off.
        return NextResponse.json({ providers: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const enabled = ModuleAuthDeclarations.filter((declared) => isEnabledIn(states, declared.module));

    return NextResponse.json(
        { providers: configuredProviderIds(enabled, process.env) },
        // Short, shared: the answer changes when an operator edits the
        // environment, which means a restart anyway.
        { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120" } },
    );
}
