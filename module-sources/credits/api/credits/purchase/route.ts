import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { creditPurchaseSchema } from "../../../lib/validations";

// POST /api/v1/credits/purchase - Admin only: add credits to a user
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const parsed = creditPurchaseSchema.safeParse(jsonBody);
    if (!parsed.success) {
        return NextResponse.json({ error: "Valid userId and amount (1-100000) required" }, { status: 400 });
    }
    const { userId, amount } = parsed.data;

    const user = await prisma.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: amount } },
        select: { creditBalance: true },
    });

    await prisma.creditTransaction.create({
        data: { userId, amount, type: "admin_grant", description: `Admin granted ${amount} credits` },
    });

    // Fire hook + activity feed entry
    const { doActionAsync } = await import("@/core/sdk");
    await doActionAsync("credits.credit.added", {
        userId,
        amount,
        type: "admin_grant",
        grantedBy: session.user.id,
    });
    await prisma.activityFeedItem.create({
        data: {
            type: "credits.credit.added",
            actorId: userId,
            title: `Received ${amount} credits`,
            icon: "Coins",
            isPublic: false,
        },
    }).catch(() => {});

    return NextResponse.json({ balance: Number(user.creditBalance) });
}
