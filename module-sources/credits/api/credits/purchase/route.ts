import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { moveCredits } from "../../../hooks/change";
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

    // The balance and the row that explains it are written together. They
    // used to be two calls, so a ledger write that failed left an operator
    // looking at a balance nothing accounts for - the one thing a credit
    // history exists to prevent. It goes through this module's own movement
    // now, the same one every other module asks for.
    const user = await prisma.$transaction(async (tx) => {
        await moveCredits(tx, {
            userId,
            amount,
            type: "admin_grant",
            description: `Admin granted ${amount} credits`,
        });
        return tx.user.findUniqueOrThrow({ where: { id: userId }, select: { creditBalance: true } });
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
