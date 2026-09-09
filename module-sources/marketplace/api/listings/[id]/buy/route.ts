import { NextRequest, NextResponse } from "next/server";
import { applyFiltersAsync } from "@/core/sdk";
import { log, logActivity, prisma, rateLimitForRole } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { purchaseRefusal, saleSplit } from "../../../../lib/sale";
import { deliveryRefusal } from "../../../../lib/delivery";
import { commissionPercent } from "../../../../lib/setup";

/**
 * POST /api/v1/marketplace/listings/[id]/buy - one member buys from another.
 *
 * Credits move in one transaction and the listing is claimed in the same one,
 * so two buyers arriving together produce one sale: the claim is a conditional
 * update on `isSold`, and if it matches no row nothing else in the transaction
 * has run.
 *
 * The handover happens after, because it reaches outside the database - a
 * command on a game server, a call to somebody's API - and cannot be rolled
 * back by a transaction that fails around it. The same shape the chest redeem
 * uses. What is new here is that a member has been paid, so a failure is
 * recorded against the sale with its reason rather than swallowed: the
 * operator is the only one who can unpick it.
 *
 * Whether anything can deliver the kind is checked before any of that. A
 * buyer who has paid, a seller who has been paid, and nothing handed over is
 * the outcome worth an extra query.
 */
type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await rateLimitForRole(
        `market-buy:${session.user.id}`,
        { maxRequests: 20, windowMs: 15 * 60 * 1000 },
        session.user.role,
    );
    if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const { id } = await params;
    const listing = await prisma.marketListing.findUnique({ where: { id } });
    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const buyer = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { creditBalance: true, username: true },
    });

    const decision = purchaseRefusal(listing, session.user.id, Number(buyer?.creditBalance ?? 0));
    if ("refuse" in decision) {
        return NextResponse.json(
            { error: "That cannot be bought", code: `market_${decision.refuse.replace(/-/g, "_")}` },
            { status: 400 },
        );
    }

    // Asked again here rather than trusted from when the listing was written:
    // a module gets uninstalled and its listings outlive it.
    const kinds = await applyFiltersAsync("marketplace.delivery.kinds", [], {});
    const cannot = deliveryRefusal(listing.kind, kinds);
    if (cannot) {
        return NextResponse.json(
            { error: "That cannot be handed over any more", code: "market_cannot_deliver" },
            { status: 400 },
        );
    }

    const split = saleSplit(decision.buy, await commissionPercent());

    let saleId: string | null = null;
    try {
        saleId = await prisma.$transaction(async (tx) => {
            // The claim. Two buyers arriving together: only one matches.
            const claimed = await tx.marketListing.updateMany({
                where: { id: listing.id, isSold: false, isActive: true },
                data: { isSold: true, soldAt: new Date() },
            });
            if (claimed.count === 0) return null;

            const paid = await tx.user.updateMany({
                where: { id: session.user.id, creditBalance: { gte: split.price } },
                data: { creditBalance: { decrement: split.price } },
            });
            if (paid.count === 0) throw new Error("balance moved");

            if (split.toSeller > 0) {
                await tx.user.update({
                    where: { id: listing.sellerId },
                    data: { creditBalance: { increment: split.toSeller } },
                });
            }

            await tx.creditTransaction.createMany({
                data: [
                    {
                        userId: session.user.id,
                        amount: -split.price,
                        type: "market_purchase",
                        description: `Bought ${listing.title}`,
                    },
                    ...(split.toSeller > 0
                        ? [{
                            userId: listing.sellerId,
                            amount: split.toSeller,
                            type: "market_sale",
                            description: `Sold ${listing.title}`,
                        }]
                        : []),
                    ...(split.commission > 0
                        ? [{
                            // No account holds the cut: the site issues this
                            // currency, so its share leaves circulation. The
                            // row exists so it can still be counted.
                            userId: null,
                            amount: -split.commission,
                            type: "market_commission",
                            description: `Commission on ${listing.title}`,
                        }]
                        : []),
                ],
            });

            const sale = await tx.marketSale.create({
                data: {
                    listingId: listing.id,
                    buyerId: session.user.id,
                    sellerId: listing.sellerId,
                    price: split.price,
                    commission: split.commission,
                    toSeller: split.toSeller,
                },
            });
            return sale.id;
        });
    } catch (err) {
        log.error("[marketplace] a sale failed", {
            listingId: listing.id,
            error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json({ error: "That sale could not be made" }, { status: 500 });
    }

    if (!saleId) {
        return NextResponse.json(
            { error: "That cannot be bought", code: "market_already_sold" },
            { status: 400 },
        );
    }

    const handover = await applyFiltersAsync(
        "marketplace.deliver",
        { handled: false, error: null },
        {
            kind: listing.kind,
            payload: listing.payload,
            buyerId: session.user.id,
            sellerId: listing.sellerId,
            listingId: listing.id,
        },
    );

    const failed = !handover.handled || handover.error !== null;
    await prisma.marketSale.update({
        where: { id: saleId },
        data: {
            delivery: failed ? "failed" : "delivered",
            reason: failed ? (handover.error ?? "nothing claimed the kind") : null,
        },
    });

    await logActivity({
        userId: session.user.id,
        action: "marketplace.listing.bought",
        entity: "market_listing",
        entityId: listing.id,
        metadata: { price: split.price, commission: split.commission, delivered: !failed },
    }).catch(() => {});

    return NextResponse.json(
        { bought: true, price: split.price, delivered: !failed },
        { headers: { "Cache-Control": "private, no-store" } },
    );
}
