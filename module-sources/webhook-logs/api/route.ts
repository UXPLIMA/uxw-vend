import { NextRequest, NextResponse } from "next/server";
import { pageParams, isAdmin, prisma } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const limit = 50;
    const { page, skip, take } = pageParams(request.nextUrl.searchParams, { fixedLimit: limit });

    const [logs, total] = await Promise.all([
        prisma.webhookLog.findMany({
            orderBy: { createdAt: "desc" },
            skip,
            take,
        }),
        prisma.webhookLog.count(),
    ]);

    return NextResponse.json({ logs, total, pages: Math.ceil(total / limit) });
}
