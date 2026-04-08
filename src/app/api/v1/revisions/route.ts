import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { listRevisions } from "@/core/lib/revisions";

/**
 * GET /api/v1/revisions?resource=blog.article&resourceId=xxx
 * Returns the revision history for a specific entity, newest first.
 */
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const resource = searchParams.get("resource");
    const resourceId = searchParams.get("resourceId");

    if (!resource || !resourceId) {
        return NextResponse.json({ error: "resource and resourceId required" }, { status: 400 });
    }

    const revisions = await listRevisions(resource, resourceId);
    return NextResponse.json({ revisions });
}
