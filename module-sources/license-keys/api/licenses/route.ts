/**
 * The keys the signed-in customer owns.
 *
 * This is the only place a key is ever returned in the clear, and only to the
 * account it was issued to.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { revealKey } from "../../lib/licenses";

export async function GET() {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await prisma.licenseKey.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { activations: { select: { id: true, label: true, activatedAt: true, lastSeenAt: true } } },
    });

    return NextResponse.json({
        licenses: rows.map((row) => ({
            id: row.id,
            key: revealKey(row.keySealed),
            productName: row.productName,
            status: row.status,
            expiresAt: row.expiresAt,
            maxActivations: row.maxActivations,
            activations: row.activations,
            createdAt: row.createdAt,
        })),
    });
}
