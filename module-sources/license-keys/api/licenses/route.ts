/**
 * The keys the signed-in customer owns.
 *
 * This is the only place a key is ever returned in the clear, and only to the
 * account it was issued to.
 *
 * It is read a page at a time because every row returned costs one AES-GCM
 * open, and a reseller account accumulates keys for years. Measured on 300k
 * keys with one owner holding 2000: unbounded, Postgres bitmap-scans and sorts
 * all of them at 55 shared buffers; with the limit and the
 * `(userId, createdAt)` index it walks the index backward and stops at 5.
 * Neither half works alone - without a limit the sort happens regardless of
 * the index.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { revealKey } from "../../lib/licenses";

/** Keys per page. Generous enough that most accounts never ask for a second. */
export const PAGE_SIZE = 50;

export async function GET(request: Request) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const cursor = new URL(request.url).searchParams.get("cursor");

    // One row past the page tells us whether a next page exists without a
    // second count query over the same index.
    const rows = await prisma.licenseKey.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { activations: { select: { id: true, label: true, activatedAt: true, lastSeenAt: true } } },
    });

    const page = rows.slice(0, PAGE_SIZE);

    return NextResponse.json({
        licenses: page.map((row) => ({
            id: row.id,
            key: revealKey(row.keySealed),
            productName: row.productName,
            status: row.status,
            expiresAt: row.expiresAt,
            maxActivations: row.maxActivations,
            activations: row.activations,
            createdAt: row.createdAt,
        })),
        nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    });
}
