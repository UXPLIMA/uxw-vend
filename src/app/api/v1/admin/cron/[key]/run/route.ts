import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { runJobNow, bootstrapScheduler } from "@/core/lib/scheduler";
import { devOnlyDetail } from "@/core/lib/api-utils";
import { log } from "@/core/lib/logger";

// POST /api/v1/admin/cron/[key]/run - Manually trigger a registered job
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ key: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { key } = await params;
    const decodedKey = decodeURIComponent(key);

    // Ensure jobs are registered before attempting to run
    await bootstrapScheduler();

    try {
        await runJobNow(decodedKey);
        return NextResponse.json({ ok: true, key: decodedKey });
    } catch (err) {
        // Whether the job ran is the operator's business; which file the
        // scheduler tripped over is not. 404 stays: the only refusal
        // runJobNow has is a key nothing is registered under.
        log.error("[cron] running a job on demand failed", {
            key: decodedKey,
            error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json(
            { error: "That job could not be run", details: devOnlyDetail(err) },
            { status: 404 },
        );
    }
}
