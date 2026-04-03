import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

// GET /api/v1/credits - Get user's credit balance and history
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { creditBalance: true },
    });

    const history = await prisma.creditTransaction.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
    });

    return NextResponse.json({
        balance: Number(user?.creditBalance || 0),
        history,
    });
}
