import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { deliverProduct } from "../../../lib/rcon";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/chest/[id] - Redeem chest item (deliver to game)
export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

        await prisma.chestItem.update({
            where: { id },
            data: { userId: target.id, giftedToId: target.id },
        });

        return NextResponse.json({ message: `Gifted to ${target.username}` });
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

    await prisma.chestItem.update({
        where: { id },
        data: { isRedeemed: true, redeemedAt: new Date() },
    });

    return NextResponse.json({ message: "Item redeemed" });
}
