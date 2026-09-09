import { NextResponse } from "next/server";
import { chatIds } from "../../lib/setup";
import { embedUrl } from "../../lib/embed";

/**
 * GET /api/v1/tawkto-chat/config - the script URL, or nothing.
 *
 * Public, because it is what every visitor's browser is about to fetch
 * anyway. It answers a whole URL rather than the two ids, so the one place
 * that decides whether they are ids is the one place that builds it: a
 * browser handed two strings would have to check them itself, and the check
 * is the point.
 */
export async function GET() {
    const { propertyId, widgetId } = await chatIds();
    const src = embedUrl(propertyId, widgetId);

    return NextResponse.json(
        { src },
        // The same for everyone and cheap, but an operator pasting an id
        // expects the next visitor to get the widget.
        { headers: { "Cache-Control": "public, max-age=60" } },
    );
}
