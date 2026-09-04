import { NextRequest, NextResponse } from "next/server";
import { prisma, readJsonBody, rateLimitForRoleAsync } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { markReadSchema } from "../lib/validations";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const notifications = await prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
    });
    const unread = await prisma.notification.count({ where: { userId: session.user.id, isRead: false } });
    return NextResponse.json({ notifications, unread });
}

export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await rateLimitForRoleAsync(
        `notification-read:${session.user.id}`,
        { maxRequests: 60, windowMs: 60_000 },
        session.user.role
    );
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests", code: "rate_limited" }, { status: 429 });
    }

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const parsed = markReadSchema.safeParse(jsonBody);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { id, markAllRead } = parsed.data;

    if (markAllRead) {
        await prisma.notification.updateMany({ where: { userId: session.user.id, isRead: false }, data: { isRead: true } });
    } else if (id) {
        await prisma.notification.updateMany({ where: { id, userId: session.user.id }, data: { isRead: true } });
    }
    return NextResponse.json({ message: "Updated" });
}
