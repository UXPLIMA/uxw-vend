import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1") || 1);
    const limit = 50;

    const [logs, total] = await Promise.all([
        prisma.webhookLog.findMany({
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.webhookLog.count(),
    ]);

    return NextResponse.json({ logs, total, pages: Math.ceil(total / limit) });
}
