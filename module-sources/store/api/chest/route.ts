import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

// GET /api/v1/chest - User's chest items
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const items = await prisma.chestItem.findMany({
        where: { userId: session.user.id, isRedeemed: false },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
}
