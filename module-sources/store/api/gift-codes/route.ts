import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
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

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const { value, description, count = 1, expiresAt } = body;

    if (!value || value <= 0) {
        return NextResponse.json({ error: "Value must be positive" }, { status: 400 });
    }

    // Generate multiple gift codes
    const codes = [];
    for (let i = 0; i < Math.min(count, 100); i++) {
        // 8 bytes, not 4. A code is a bearer secret worth credits and the
        // redeem endpoint says whether a guess exists, so the code space is
        // the second half of that defence: 32 bits is walkable, 64 is not.
        const code = `GIFT-${randomBytes(8).toString("hex").toUpperCase()}`;

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
