import { NextResponse } from "next/server";
import { crispWebsiteId } from "../../lib/setup";
import { safeWebsiteId } from "../../lib/embed";

/**
 * GET /api/v1/crisp-chat/config - the site id, or nothing.
 *
 * Public, because it is what every visitor's browser is about to use anyway.
 * It answers only an id that passed, so the one place that decides whether a
 * setting is an id is the one place that hands it out: a browser given the
 * raw string would have to check it itself, and the check is the point.
 */
export async function GET() {
    const websiteId = safeWebsiteId(await crispWebsiteId());

    return NextResponse.json(
        { websiteId },
        // The same for everyone and cheap, but an operator pasting an id
        // expects the next visitor to get the widget.
        { headers: { "Cache-Control": "public, max-age=60" } },
    );
}
