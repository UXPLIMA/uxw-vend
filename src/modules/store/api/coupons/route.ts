import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { couponSchema } from "@/core/lib/validations";

// GET /api/v1/store/coupons
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const coupons = await prisma.coupon.findMany({
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ coupons });
}

// POST /api/v1/store/coupons
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
    const validation = couponSchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const existing = await prisma.coupon.findUnique({
        where: { code: validation.data.code },
    });
    if (existing) {
        return NextResponse.json({ error: "Coupon code already exists" }, { status: 400 });
    }

    const coupon = await prisma.coupon.create({
        data: {
            ...validation.data,
            startsAt: validation.data.startsAt ? new Date(validation.data.startsAt) : null,
            expiresAt: validation.data.expiresAt ? new Date(validation.data.expiresAt) : null,
        },
    });

    return NextResponse.json({ coupon }, { status: 201 });
}
