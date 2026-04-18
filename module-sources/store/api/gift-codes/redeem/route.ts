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

    const creditAmount = Number(giftCode.value);

    // Add credits to user balance and create transaction
    const [user] = await prisma.$transaction([
        prisma.user.update({
            where: { id: session.user.id },
            data: { creditBalance: { increment: creditAmount } },
            select: { creditBalance: true },
        }),
        prisma.creditTransaction.create({
            data: {
                userId: session.user.id,
                amount: creditAmount,
                type: "gift_redeem",
                description: `Redeemed gift code ${giftCode.code} for ${creditAmount} credits`,
            },
        }),
    ]);

    return NextResponse.json({
        message: `Gift code redeemed! ${creditAmount.toFixed(2)} credits added to your balance.`,
        value: creditAmount,
        newBalance: Number(user.creditBalance),
    });
}
