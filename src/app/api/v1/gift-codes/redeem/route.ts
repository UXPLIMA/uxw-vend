import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

// POST /api/v1/gift-codes/redeem - Redeem a gift code
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code) {
        return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const giftCode = await prisma.giftCode.findUnique({
        where: { code: code.trim().toUpperCase() },
    });

    if (!giftCode) {
        return NextResponse.json({ error: "Invalid gift code" }, { status: 404 });
    }

    if (giftCode.isRedeemed) {
        return NextResponse.json({ error: "This code has already been redeemed" }, { status: 400 });
    }

    if (giftCode.expiresAt && giftCode.expiresAt < new Date()) {
        return NextResponse.json({ error: "This code has expired" }, { status: 400 });
    }

    // Atomic mark as redeemed (prevents race condition / double redemption)
    const updated = await prisma.giftCode.updateMany({
        where: { id: giftCode.id, isRedeemed: false },
        data: { isRedeemed: true, redeemedAt: new Date(), redeemedById: session.user.id },
    });
    if (updated.count === 0) {
        return NextResponse.json({ error: "This code has already been redeemed" }, { status: 400 });
    }

    // For now, gift codes give a discount on next order (stored as a one-time coupon)
    // Create a personal coupon for this user
    const couponCode = `GIFT-${giftCode.code}`;
    await prisma.coupon.create({
        data: {
            code: couponCode,
            description: `Gift code: ${giftCode.code}`,
            type: "FIXED",
            value: giftCode.value,
            usageLimit: 1,
            isActive: true,
        },
    });

    return NextResponse.json({
        message: `Gift code redeemed! You received a $${Number(giftCode.value).toFixed(2)} discount. Use code ${couponCode} at checkout.`,
        value: Number(giftCode.value),
        couponCode,
    });
}
