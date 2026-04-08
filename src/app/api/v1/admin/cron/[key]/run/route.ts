import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { runJobNow, bootstrapScheduler } from "@/core/lib/scheduler";

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
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 404 });
    }
}
