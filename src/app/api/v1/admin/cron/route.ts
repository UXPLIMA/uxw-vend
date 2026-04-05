import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { runScheduledTasks } from "@/core/lib/scheduled-tasks";
import { validateApiKey } from "@/core/lib/api-key-auth";

// POST /api/v1/admin/cron - Run scheduled tasks
export async function POST(request: NextRequest) {
    // Allow via API key or admin session
    const rawKey = request.headers.get("x-api-key");
    if (rawKey) {
        const result = await validateApiKey(rawKey, "cron:run");
        if (!result.valid) return NextResponse.json({ error: result.error }, { status: result.status });
    } else {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const results = await runScheduledTasks();
    return NextResponse.json({ results, ran: results.length });
}
