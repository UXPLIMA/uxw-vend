import { NextRequest, NextResponse } from "next/server";
import { prisma, rateLimitForRole } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { deliverProduct } from "../../../lib/delivery";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/chest/[id] - Redeem chest item (deliver to game)
export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await rateLimitForRole(
        `chest-redeem:${session.user.id}`,
        { maxRequests: 30, windowMs: 15 * 60 * 1000 },
        session.user.role,
    );
    if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const item = await prisma.chestItem.findUnique({ where: { id } });
    if (!item || item.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (item.isRedeemed) return NextResponse.json({ error: "Already redeemed" }, { status: 400 });

    // Gift to another user
    if (body.giftTo) {
        const target = await prisma.user.findFirst({
            where: { OR: [{ username: body.giftTo }, { id: body.giftTo }] },
        });
        if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

        // Conditional on the row still being this user's and unredeemed, so a
        // gift racing a redeem cannot both win.
        const gifted = await prisma.chestItem.updateMany({
            where: { id, userId: session.user.id, isRedeemed: false },
            data: { userId: target.id, giftedToId: target.id },
        });
        if (gifted.count === 0) {
            return NextResponse.json({ error: "Already redeemed" }, { status: 400 });
        }

        return NextResponse.json({ message: `Gifted to ${target.username}` });
    }

    // Claim the item before delivering it, not after.
    //
    // The read above and the write below used to sit on either side of the
    // RCON delivery: two requests that arrived together both read
    // `isRedeemed: false`, both ran the commands, and the player received the
    // item twice. The gift-code route has always claimed with a conditional
    // updateMany for exactly this reason; this one did not.
    //
    // Delivery failure does not hand the item back, which is what the old code
    // did too - it delivered with `.catch(console.error)` and marked the item
    // redeemed regardless.
    const claimed = await prisma.chestItem.updateMany({
        where: { id, userId: session.user.id, isRedeemed: false },
        data: { isRedeemed: true, redeemedAt: new Date() },
    });
    if (claimed.count === 0) {
        return NextResponse.json({ error: "Already redeemed" }, { status: 400 });
    }

    // Redeem: execute RCON commands
    const commands = await prisma.productCommand.findMany({
        where: { productId: item.productId },
        orderBy: { order: "asc" },
    });

    if (commands.length > 0) {
        const playerName = body.playerName || session.user.name || "Player";
        await deliverProduct({
            playerName,
            productName: item.productName,
            commands: commands.map((c) => ({ command: c.command, serverId: c.serverId })),
            quantity: item.quantity,
        }).catch(console.error);
    }

    return NextResponse.json({ message: "Item redeemed" });
}
