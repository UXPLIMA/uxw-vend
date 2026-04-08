import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { runScheduledTasks } from "@/core/lib/scheduled-tasks";
import { validateApiKey } from "@/core/lib/api-key-auth";
import { prisma } from "@/core/lib/db";
import { listRegisteredJobs, bootstrapScheduler } from "@/core/lib/scheduler";

interface CronJobRow {
    key: string;
    schedule: string;
    lastRunAt: string | null;
    lastStatus: string | null;
    lastError: string | null;
    lastRunMs: number | null;
    nextRunAt: string | null;
}

// GET /api/v1/admin/cron - List registered jobs joined with their CronRun row
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Ensure module-contributed jobs are loaded so admins see the full list
    // even on a freshly booted dev process that has not yet ticked.
    await bootstrapScheduler();

    const registered = listRegisteredJobs();
    const runs = await prisma.cronRun.findMany();
    const runMap = new Map(runs.map((r) => [r.jobKey, r]));

    const jobs: CronJobRow[] = registered
        .map((j) => {
            const run = runMap.get(j.key);
            return {
                key: j.key,
                schedule: j.schedule,
                lastRunAt: run?.lastRunAt ? run.lastRunAt.toISOString() : null,
                lastStatus: run?.lastStatus ?? null,
                lastError: run?.lastError ?? null,
                lastRunMs: run?.lastRunMs ?? null,
                nextRunAt: run?.nextRunAt ? run.nextRunAt.toISOString() : null,
            };
        })
        .sort((a, b) => a.key.localeCompare(b.key));

    return NextResponse.json({ jobs });
}

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
