import { NextResponse } from "next/server";
import { prisma } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

// GET /api/v1/chest - User's chest items
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Bounded: a chest is one person's and usually short, but it grows by
    // one row per line of every order they never claimed, and nothing has
    // ever trimmed it.
    const items = await prisma.chestItem.findMany({
        where: { userId: session.user.id, isRedeemed: false },
        orderBy: { createdAt: "desc" },
        take: 200,
    });

    return NextResponse.json({ items });
}
