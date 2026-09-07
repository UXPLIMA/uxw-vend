import { NextResponse } from "next/server";
import { moduleSettings } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

/**
 * May this caller read the forum at all?
 *
 * A forum can be a public shop window or a members' room, and which one it is
 * has to be decided on the server: the pages that read these endpoints are
 * client components, so hiding a link would leave the JSON reachable by anyone
 * who typed the URL.
 *
 * The predicate is separate from the 403 because not every reader of this rule
 * is answering a request. Site search asks it too, and it has nothing to send
 * back - it contributes results or it contributes none. When the rule lived
 * only in `denyGuestView`, search could not consult it and did not: a forum an
 * operator had closed answered 403 at its own endpoints while site search
 * handed a stranger the title and the opening of every topic in it.
 */
export async function mayViewForum(): Promise<boolean> {
    const session = await auth();
    if (session?.user?.id) return true;

    const { allowGuestView } = await moduleSettings<{ allowGuestView: boolean }>("forum");
    return Boolean(allowGuestView);
}

/**
 * The same rule, as something an endpoint can return.
 *
 * Returns a 403 to send back, or null when the caller may read.
 */
export async function denyGuestView(): Promise<NextResponse | null> {
    if (await mayViewForum()) return null;

    return NextResponse.json(
        { error: "Sign in to view the forum", code: "guest_view_disabled" },
        { status: 403 },
    );
}
