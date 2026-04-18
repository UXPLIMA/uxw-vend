import { NextResponse } from "next/server";
import spec from "@/core/generated/openapi.json";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";

/**
 * Serves the pre-generated OpenAPI 3.0 spec.
 *
 * Generation is handled by scripts/generate-openapi.ts (runs as part of
 * `npm run prebuild`). Serving from a static JSON keeps this route cheap
 * and avoids re-reading module manifests on every request.
 *
 * Access policy:
 *   - Admins: full spec (includes /admin/* endpoints).
 *   - Anyone else: 401. The spec enumerates every admin route the
 *     platform exposes, so letting anonymous clients scrape it is an
 *     unnecessary reconnaissance gift.
 *
 * Operators who want a public, read-only catalog can set
 * OPENAPI_PUBLIC=1 to bypass the admin check — this makes explicit what
 * used to be implicit with `Access-Control-Allow-Origin: *`.
 */
export async function GET() {
    const publicMode = process.env.OPENAPI_PUBLIC === "1";
    if (!publicMode) {
        const session = await auth();
        if (!session?.user?.id || !(await isAdmin(session.user.id))) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }
    }
    return NextResponse.json(spec, {
        headers: {
            "Cache-Control": "private, max-age=300",
        },
    });
}
