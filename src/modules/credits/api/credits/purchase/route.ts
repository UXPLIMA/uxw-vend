import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// POST /api/v1/credits/purchase - Admin only: add credits to a user
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId, amount } = await request.json();

    if (!userId || !amount || amount <= 0 || amount > 100000) {
        return NextResponse.json({ error: "Valid userId and amount (1-100000) required" }, { status: 400 });
    }

    const user = await prisma.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: amount } },
        select: { creditBalance: true },
    });

    await prisma.creditTransaction.create({
        data: { userId, amount, type: "admin_grant", description: `Admin granted ${amount} credits` },
    });

    return NextResponse.json({ balance: Number(user.creditBalance) });
}
