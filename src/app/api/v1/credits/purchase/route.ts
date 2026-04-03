import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

// POST /api/v1/credits/purchase - Add credits to user balance
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { amount } = await request.json();

    if (!amount || amount <= 0) {
        return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }

    // Update balance and create transaction
    const user = await prisma.user.update({
        where: { id: session.user.id },
        data: { creditBalance: { increment: amount } },
        select: { creditBalance: true },
    });

    await prisma.creditTransaction.create({
        data: {
            userId: session.user.id,
            amount,
            type: "purchase",
            description: `Purchased ${amount} credits`,
        },
    });

    return NextResponse.json({
        balance: Number(user.creditBalance),
        message: `${amount} credits added to your account`,
    });
}
