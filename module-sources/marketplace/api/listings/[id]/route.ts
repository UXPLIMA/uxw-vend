import { NextRequest, NextResponse } from "next/server";
import { isAdmin, logActivity, prisma } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * DELETE /api/v1/marketplace/listings/[id] - take a listing down.
 *
 * Switched off rather than removed. A sale points at the listing it was for,
 * and a buyer looking at what they bought needs it to still be there.
 *
 * The seller may take down their own; an operator may take down anybody's.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const listing = await prisma.marketListing.findUnique({ where: { id }, select: { sellerId: true } });
    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const theirs = listing.sellerId === session.user.id;
    if (!theirs && !(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Conditional on it being unsold: taking down something already bought
    // would hide it from the buyer who is waiting for it.
    const taken = await prisma.marketListing.updateMany({
        where: { id, isSold: false },
        data: { isActive: false },
    });
    if (taken.count === 0) {
        return NextResponse.json(
            { error: "That has already sold", code: "market_already_sold" },
            { status: 400 },
        );
    }

    await logActivity({
        userId: session.user.id,
        action: "marketplace.listing.withdrawn",
        entity: "market_listing",
        entityId: id,
    }).catch(() => {});

    return NextResponse.json({ withdrawn: true });
}
