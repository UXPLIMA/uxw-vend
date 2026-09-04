import { NextRequest, NextResponse } from "next/server";
import { moduleSettings, prisma, rateLimitStrict, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

// POST /api/v1/gift-codes/redeem - Redeem a gift code
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // A gift code is a bearer secret worth credits, and the reply says
    // whether a guess exists. Without a ceiling, working through the code
    // space is only a matter of time.
    const rl = await rateLimitStrict(`gift-redeem:${session.user.id}`, {
        maxRequests: 10,
        windowMs: 15 * 60 * 1000,
    });
    if (!rl.success) {
        return NextResponse.json(
            { error: "Too many attempts. Try again later." },
            { status: 429 },
        );
    }

    const { enableGiftCards } = await moduleSettings<{ enableGiftCards: boolean }>("store");
    if (!enableGiftCards) {
        return NextResponse.json({ error: "Gift codes are not accepted" }, { status: 403 });
    }

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const { code } = jsonBody;

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
