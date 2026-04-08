import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

const VALID_STATUSES = ["pending", "sending", "sent", "failed"] as const;
type EmailStatus = (typeof VALID_STATUSES)[number];

const PAGE_SIZE = 50;

// GET /api/v1/admin/email-queue?status=pending&page=1
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const status: EmailStatus | null =
        statusParam && (VALID_STATUSES as readonly string[]).includes(statusParam)
            ? (statusParam as EmailStatus)
            : null;

    const pageRaw = parseInt(url.searchParams.get("page") || "1", 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

    const where = status ? { status } : {};

    const [jobs, total, grouped] = await Promise.all([
        prisma.emailJob.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            select: {
                id: true,
                to: true,
                subject: true,
                status: true,
                attempts: true,
                lastError: true,
                scheduledAt: true,
                sentAt: true,
                createdAt: true,
            },
        }),
        prisma.emailJob.count({ where }),
        prisma.emailJob.groupBy({
            by: ["status"],
            _count: { _all: true },
        }),
    ]);

    const summary: Record<EmailStatus, number> = {
        pending: 0,
        sending: 0,
        sent: 0,
        failed: 0,
    };
    for (const row of grouped) {
        if ((VALID_STATUSES as readonly string[]).includes(row.status)) {
            summary[row.status as EmailStatus] = row._count._all;
        }
    }

    return NextResponse.json({
        jobs,
        total,
        page,
        pageSize: PAGE_SIZE,
        summary,
    });
}
