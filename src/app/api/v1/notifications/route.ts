import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

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

    const { id, markAllRead } = await request.json();

    if (markAllRead) {
        await prisma.notification.updateMany({ where: { userId: session.user.id, isRead: false }, data: { isRead: true } });
    } else if (id) {
        await prisma.notification.updateMany({ where: { id, userId: session.user.id }, data: { isRead: true } });
    }
    return NextResponse.json({ message: "Updated" });
}
