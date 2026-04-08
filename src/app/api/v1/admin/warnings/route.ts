import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { logActivity } from "@/core/lib/activity-log";

/**
 * GET /api/v1/admin/warnings
 * List all warnings across all users, newest first, paginated.
 * Optional filters: ?userId=xxx&active=true&page=1
 */
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || undefined;
    const activeParam = searchParams.get("active");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const perPage = 50;

    const where = {
        ...(userId ? { userId } : {}),
        ...(activeParam === "true" ? { isActive: true } : {}),
        ...(activeParam === "false" ? { isActive: false } : {}),
    };

    const [warnings, total] = await Promise.all([
        prisma.userWarning.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * perPage,
            take: perPage,
            include: {
                user: { select: { id: true, username: true } },
                issuedBy: { select: { id: true, username: true } },
            },
        }),
        prisma.userWarning.count({ where }),
    ]);

    return NextResponse.json({
        warnings,
        total,
        page,
        pages: Math.max(1, Math.ceil(total / perPage)),
    });
}

const createSchema = z.object({
    userId: z.string().min(1),
    reason: z.string().min(1).max(500),
    points: z.number().int().min(1).max(100).default(1),
    expiresAt: z.string().datetime().nullable().optional(),
});

/**
 * POST /api/v1/admin/warnings
 * Issue a new warning.
 */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid" }, { status: 400 });
    }

    const warning = await prisma.userWarning.create({
        data: {
            userId: parsed.data.userId,
            issuedById: session.user.id,
            reason: parsed.data.reason,
            points: parsed.data.points,
            expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
            isActive: true,
        },
        include: {
            user: { select: { id: true, username: true } },
            issuedBy: { select: { id: true, username: true } },
        },
    });

    logActivity({
        userId: session.user.id,
        action: "warning.issue",
        entity: "user",
        entityId: parsed.data.userId,
        metadata: {
            warningId: warning.id,
            reason: parsed.data.reason,
            points: parsed.data.points,
            expiresAt: parsed.data.expiresAt ?? null,
        },
    }).catch(() => {});

    return NextResponse.json({ warning }, { status: 201 });
}
