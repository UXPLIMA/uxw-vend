import { NextResponse } from "next/server";
import { moduleSettings } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

/**
 * The `allowGuestView` setting, enforced.
 *
 * A forum can be a public shop window or a members' room, and which one it is
 * has to be decided on the server: the pages that read these endpoints are
 * client components, so hiding a link would leave the JSON reachable by anyone
 * who typed the URL.
 *
 * Returns a 403 to send back, or null when the caller may read.
 */
export async function denyGuestView(): Promise<NextResponse | null> {
    const session = await auth();
    if (session?.user?.id) return null;

    const { allowGuestView } = await moduleSettings<{ allowGuestView: boolean }>("forum");
    if (allowGuestView) return null;

    return NextResponse.json(
        { error: "Sign in to view the forum", code: "guest_view_disabled" },
        { status: 403 },
    );
}
