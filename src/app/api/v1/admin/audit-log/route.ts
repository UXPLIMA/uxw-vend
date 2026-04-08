import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

type AuditLogQuery = {
    action?: string;
    userId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    export?: "csv";
};

function parseQuery(req: NextRequest): AuditLogQuery {
    const sp = req.nextUrl.searchParams;
    return {
        action: sp.get("action") || undefined,
        userId: sp.get("userId") || undefined,
        from: sp.get("from") || undefined,
        to: sp.get("to") || undefined,
        page: Math.max(1, parseInt(sp.get("page") || "1") || 1),
        limit: Math.min(500, Math.max(1, parseInt(sp.get("limit") || "50") || 50)),
        export: sp.get("export") === "csv" ? "csv" : undefined,
    };
}

function buildWhere(q: AuditLogQuery): Prisma.ActivityLogWhereInput {
    const where: Prisma.ActivityLogWhereInput = {};
    if (q.action) where.action = q.action;
    if (q.userId) where.userId = q.userId;
    if (q.from || q.to) {
        const created: Prisma.DateTimeFilter = {};
        if (q.from) {
            const d = new Date(q.from);
            if (!isNaN(d.getTime())) created.gte = d;
        }
        if (q.to) {
            const d = new Date(q.to);
            if (!isNaN(d.getTime())) {
                // "to" is inclusive: set to end of day if no time
                if (q.to.length <= 10) d.setHours(23, 59, 59, 999);
                created.lte = d;
            }
        }
        where.createdAt = created;
    }
    return where;
}

function csvEscape(value: unknown): string {
    if (value == null) return "";
    const str = typeof value === "string" ? value : JSON.stringify(value);
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// GET /api/v1/admin/audit-log
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const q = parseQuery(request);
    const where = buildWhere(q);

    if (q.export === "csv") {
        const rows = await prisma.activityLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 10000,
            include: { user: { select: { id: true, username: true } } },
        });

        const header = [
            "timestamp",
            "userId",
            "username",
            "action",
            "entity",
            "entityId",
            "ipAddress",
            "metadata",
        ];
        const lines = [header.join(",")];
        for (const r of rows) {
            lines.push(
                [
                    csvEscape(r.createdAt.toISOString()),
                    csvEscape(r.userId),
                    csvEscape(r.user?.username ?? ""),
                    csvEscape(r.action),
                    csvEscape(r.entity),
                    csvEscape(r.entityId),
                    csvEscape(r.ipAddress),
                    csvEscape(r.metadata ?? ""),
                ].join(","),
            );
        }

        return new NextResponse(lines.join("\n"), {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="audit-log-${Date.now()}.csv"`,
            },
        });
    }

    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const [logs, total, actionsRaw] = await Promise.all([
        prisma.activityLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            include: { user: { select: { id: true, username: true } } },
        }),
        prisma.activityLog.count({ where }),
        prisma.activityLog.findMany({
            distinct: ["action"],
            select: { action: true },
            orderBy: { action: "asc" },
            take: 200,
        }),
    ]);

    return NextResponse.json({
        logs,
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
        actions: actionsRaw.map((a) => a.action),
    });
}
