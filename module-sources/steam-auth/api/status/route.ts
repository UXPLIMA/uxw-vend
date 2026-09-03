/**
 * The two URLs a Steam application has to be registered with.
 *
 * Whether the module is configured at all is core's question, answered for
 * every provider at /api/v1/auth-providers/status. What core cannot know is
 * that Steam wants a domain and a return URL rather than the standard Auth.js
 * callback, because this module runs its own OpenID 2.0 flow.
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
    return NextResponse.json({ realm: appUrl, returnTo: steamReturnTo(appUrl) });
}
