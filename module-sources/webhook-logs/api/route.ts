import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

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
