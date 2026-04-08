import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { queueBroadcast } from "@/core/lib/broadcasts";
import { logActivity } from "@/core/lib/activity-log";

/** GET — list broadcasts (admin) */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const broadcasts = await prisma.emailBroadcast.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    return NextResponse.json({ broadcasts });
}

const filterSchema = z.object({
    all: z.boolean().optional(),
    roleIds: z.array(z.string()).optional(),
    userIds: z.array(z.string()).optional(),
});

const createSchema = z.object({
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(50_000),
    filter: filterSchema.default({ all: true }),
    sendNow: z.boolean().default(false),
});

/** POST — create + optionally queue (admin) */
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

    const broadcast = await prisma.emailBroadcast.create({
        data: {
            subject: parsed.data.subject,
            body: parsed.data.body,
            filter: parsed.data.filter,
            createdById: session.user.id,
            status: "draft",
        },
    });

    if (parsed.data.sendNow) {
        const result = await queueBroadcast(broadcast.id);

        logActivity({
            userId: session.user.id,
            action: "broadcast.send",
            entity: "broadcast",
            entityId: broadcast.id,
            metadata: {
                subject: broadcast.subject,
                recipientCount: result.totalCount,
                filter: parsed.data.filter,
            },
        }).catch(() => {});

        return NextResponse.json({ broadcast, queuedRecipients: result.totalCount }, { status: 201 });
    }

    logActivity({
        userId: session.user.id,
        action: "broadcast.create",
        entity: "broadcast",
        entityId: broadcast.id,
        metadata: { subject: broadcast.subject },
    }).catch(() => {});

    return NextResponse.json({ broadcast }, { status: 201 });
}
