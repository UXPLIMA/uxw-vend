import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
const CREATOR_DEFAULT_DISCOUNT = 5;
const CREATOR_DEFAULT_COMMISSION = 10;

async function getSetting(key: string, defaultValue: string): Promise<string> {
    const s = await prisma.setting.findUnique({ where: { key } });
    return (s?.value as string) ?? defaultValue;
}

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

    const defaultDiscount = Number(await getSetting("creator_default_discount", String(CREATOR_DEFAULT_DISCOUNT)));
    const defaultCommission = Number(await getSetting("creator_default_commission", String(CREATOR_DEFAULT_COMMISSION)));

    const creatorCode = await prisma.creatorCode.create({
        data: {
            code: code.toUpperCase(),
            creatorId,
            discountPercent: discountPercent || defaultDiscount,
            commissionPercent: commissionPercent || defaultCommission,
        },
    });
    return NextResponse.json({ creatorCode }, { status: 201 });
}
