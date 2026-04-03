import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/creator-codes - List (admin: all, user: own)
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminCheck = await isAdmin(session.user.id);
    const where = adminCheck ? {} : { creatorId: session.user.id };

    const codes = await prisma.creatorCode.findMany({
        where,
        include: { creator: { select: { id: true, username: true } } },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ codes });
}

// POST /api/v1/creator-codes - Create (admin)
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { code, creatorId, discountPercent, commissionPercent } = await request.json();
    if (!code || !creatorId) return NextResponse.json({ error: "Code and creator required" }, { status: 400 });

    const existing = await prisma.creatorCode.findUnique({ where: { code: code.toUpperCase() } });
    if (existing) return NextResponse.json({ error: "Code already exists" }, { status: 400 });

    const creatorCode = await prisma.creatorCode.create({
        data: {
            code: code.toUpperCase(),
            creatorId,
            discountPercent: discountPercent || 5,
            commissionPercent: commissionPercent || 5,
        },
    });
    return NextResponse.json({ creatorCode }, { status: 201 });
}
