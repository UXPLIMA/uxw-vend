import { NextResponse } from "next/server";
import { isAdmin, devOnlyDetail, log } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { registerTrophyListeners } from "../../../lib/trophy-engine";

/**
 * POST /api/v1/trophies/admin/reload
 *
 * Re-registers the trophy auto-award engine after rule edits so freshly
 * saved rule changes take effect without requiring a server restart.
 * Note: hooks.ts does not currently support listener removal, so calling
 * this multiple times layers listeners on top of each other. Because
 * `awardIfQualified` is idempotent (upsert), duplicate wiring is
 * harmless - only the first listener ever actually writes.
 */
export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        await registerTrophyListeners(true);
        return NextResponse.json({ ok: true });
    } catch (err) {
        log.error("[trophies] reloading the listeners failed", {
            error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json(
            { error: "Reload failed", details: devOnlyDetail(err) },
            { status: 500 },
        );
    }
}
