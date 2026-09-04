import { NextRequest, NextResponse } from "next/server";
import { intParam, isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { giftCodeCreateSchema } from "../../lib/validations";
import { randomBytes } from "crypto";

// GET /api/v1/gift-codes - One page of codes, newest first (admin).
//
// This used to read the whole table. Codes are generated in batches - the
// form on the admin screen takes a count - so the table is exactly the kind
// that grows in thousands, and every one of them was serialised into one
// response and rendered into one table on every visit to the page.
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const page = intParam(params, "page", { fallback: 1, min: 1 });
    const perPage = intParam(params, "perPage", { fallback: 50, min: 1, max: 200 });

    const [giftCodes, total] = await Promise.all([
        prisma.giftCode.findMany({
            include: {
                redeemedBy: { select: { id: true, username: true } },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * perPage,
            take: perPage,
        }),
        prisma.giftCode.count(),
    ]);

    return NextResponse.json({
        giftCodes,
        total,
        page,
        pages: Math.max(1, Math.ceil(total / perPage)),
    });
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
    const parsed = giftCodeCreateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Value must be positive" }, { status: 400 });
    }
    const { value, description, expiresAt } = parsed.data;
    const count = parsed.data.count ?? 1;

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
