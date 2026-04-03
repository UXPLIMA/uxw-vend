import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { randomBytes } from "crypto";

// GET /api/v1/gift-codes - List all (admin)
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const giftCodes = await prisma.giftCode.findMany({
        include: {
            redeemedBy: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ giftCodes });
}

// POST /api/v1/gift-codes - Create gift codes (admin)
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { value, description, count = 1, expiresAt } = body;

    if (!value || value <= 0) {
        return NextResponse.json({ error: "Value must be positive" }, { status: 400 });
    }

    // Generate multiple gift codes
    const codes = [];
    for (let i = 0; i < Math.min(count, 100); i++) {
        const code = `GIFT-${randomBytes(4).toString("hex").toUpperCase()}`;

        const giftCode = await prisma.giftCode.create({
            data: {
                code,
                value,
                description: description || null,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                createdById: session.user.id,
            },
        });

        codes.push(giftCode);
    }

    return NextResponse.json({ giftCodes: codes, count: codes.length }, { status: 201 });
}
