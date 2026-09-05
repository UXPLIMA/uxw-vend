/**
 * What happens once the money has actually arrived.
 *
 * This used to live inside the Stripe webhook, which meant PayPal had a second
 * copy of it and any third gateway would have needed a third. It is the
 * store's work, not a gateway's: mark the order paid, grant what was bought,
 * record the payment, email the buyer, run the delivery commands, and tell the
 * rest of the site. A gateway only reports that money moved.
 */
import { prisma, log } from "@/core/sdk/server";
import { sendOrderConfirmationEmail } from "./order-email";
import { deliverProduct } from "./delivery";
import { announceOrderCompleted } from "./order-events";

const OK: PaymentOutcome = { handled: true, duplicate: false, error: null };
const ALREADY: PaymentOutcome = { handled: true, duplicate: true, error: null };

function failed(error: string): PaymentOutcome {
    return { handled: true, duplicate: false, error };
}

/**
 * The ledger row id for one credit purchase.
 *
 * Deterministic on purpose: it is the idempotency key for a top-up, enforced
 * by the primary key rather than by a search that two callers can both lose.
 */
function creditLedgerId(provider: string, providerRef: string): string {
    return `credit:${provider}:${providerRef}`;
}

/**
 * Settles an order.
 *
 * Ownership is granted here and nowhere earlier: an order is created PENDING
 * at checkout and stays that way until a gateway says it was paid for.
 */
export async function settleOrder(settlement: PaymentSettlement): Promise<PaymentOutcome> {
    const order = await prisma.order.findUnique({
        where: { id: settlement.reference },
        include: { user: { select: { email: true, username: true, locale: true } }, items: true },
    });
    if (!order) return failed("unknown order");
    // Webhooks retry, and a buyer can reload a return URL. Both arrive here.
    if (order.status === "COMPLETED") return ALREADY;

    // Order.userId is nullable: the account can be deleted between paying and
    // the webhook landing. The order is still paid, so it stays COMPLETED, but
    // there is nobody left to grant anything to.
    const buyerId = order.userId;
    const buyer = order.user;
    const granted = buyerId ? order.items.filter((item) => item.productId) : [];
    const productIds = [...new Set(granted.map((item) => item.productId as string))];

    // Marking the order paid, granting what was bought and recording the
    // payment are one transaction or none of them.
    //
    // They used to run one after another. A process that died between the
    // status update and the grants left a buyer who had paid with a COMPLETED
    // order and an empty chest - and the duplicate guard above then refused
    // every webhook retry that would have fixed it, permanently.
    //
    // The status precondition is the other half. The read above is a
    // snapshot: a gateway retry and a reloaded return URL arriving together
    // both saw PENDING, both passed it, and both granted the same order. A
    // transaction does not close that on its own, exactly as it does not for
    // the credit balance at checkout; the condition in the `where` does, by
    // leaving the second one with nothing to update.
    const settled = await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
            where: { id: order.id, status: { not: "COMPLETED" } },
            data: {
                status: "COMPLETED",
                paymentMethod: settlement.provider,
                paymentId: settlement.providerRef,
            },
        });
        if (claimed.count === 0) return false;

        if (buyerId && granted.length > 0) {
            await tx.chestItem.createMany({
                data: granted.map((item) => ({
                    userId: buyerId,
                    productId: item.productId as string,
                    productName: item.name,
                    quantity: item.quantity,
                    orderId: order.id,
                })),
            });
            // One row per product, however many of it was bought: the unique
            // key is (userId, productId), and owning it twice means nothing.
            await tx.ownedProduct.createMany({
                data: productIds.map((productId) => ({ userId: buyerId, productId, orderId: order.id })),
                skipDuplicates: true,
            });
        }

        await tx.payment.create({
            data: {
                orderId: settlement.reference,
                provider: settlement.provider,
                providerId: settlement.providerRef,
                amount: settlement.amount,
                currency: settlement.currency.toLowerCase(),
                status: "COMPLETED",
                ...(settlement.metadata ? { metadata: settlement.metadata } : {}),
            },
        });
        return true;
    });

    // Another delivery of the same payment got there first.
    if (!settled) return ALREADY;

    if (!buyerId || !buyer) {
        log.warn("[store] order paid for by an account that no longer exists", { orderId: order.id });
        return OK;
    }

    // Neither of these may hold up the answer to the gateway: the order is
    // paid and granted either way, and a webhook left waiting gets retried.
    sendOrderConfirmationEmail({
        to: buyer.email,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        locale: buyer.locale,
    }).catch((error: unknown) =>
        log.error("[store] order confirmation email failed", { orderId: order.id, error: String(error) }),
    );

    const playerName =
        settlement.metadata?.playerName ||
        ((order.metadata as Record<string, unknown>)?.playerName as string) ||
        buyer.username ||
        "Player";

    // One query for every product's commands rather than one per item: an
    // order of twelve things was twelve round trips before the buyer got a
    // reply, and a gateway webhook has a timeout.
    const commandRows = productIds.length
        ? await prisma.productCommand.findMany({
              where: { productId: { in: productIds } },
              orderBy: { order: "asc" },
          })
        : [];
    const commandsByProduct = new Map<string, typeof commandRows>();
    for (const row of commandRows) {
        const list = commandsByProduct.get(row.productId);
        if (list) list.push(row);
        else commandsByProduct.set(row.productId, [row]);
    }

    for (const item of granted) {
        const commands = commandsByProduct.get(item.productId as string);
        if (!commands || commands.length === 0) continue;

        const itemVars = (item.metadata as Record<string, unknown>)?.variables as
            | Record<string, string>
            | undefined;

        deliverProduct({
            playerName,
            productName: item.name,
            commands: commands.map((c) => ({ command: c.command, serverId: c.serverId })),
            quantity: item.quantity,
            variables: itemVars,
        }).catch((error) => log.error("[store] delivery failed", { orderId: order.id, error: String(error) }));
    }

    await announceOrderCompleted(order.id);
    return OK;
}


/**
 * Settles a wallet top-up.
 *
 * The credit amount is what the store asked the gateway to carry, not what the
 * buyer's browser said: it is read back out of the session metadata the store
 * itself wrote.
 */
export async function settleCredits(settlement: PaymentSettlement): Promise<PaymentOutcome> {
    const userId = settlement.metadata?.userId;
    const credits = Number(settlement.metadata?.creditAmount ?? 0);
    if (!userId || !(credits > 0)) return failed("credit purchase is missing its amount or buyer");

    // The gateway's own id for the money is the idempotency key, and the
    // ledger row's primary key is where it is enforced.
    //
    // Looking for the row first and writing after did not close anything: a
    // gateway retry and a reloaded return URL arriving together both found no
    // row - the search was `description: { contains: … }`, a scan of the whole
    // ledger at that - and both credited the account. Giving the row a
    // deterministic id makes the second insert a duplicate key, and the
    // transaction takes the balance increment down with it.
    const ledgerId = creditLedgerId(settlement.provider, settlement.providerRef);
    const already = await prisma.creditTransaction.findUnique({ where: { id: ledgerId } });
    if (already) return ALREADY;

    try {
        await prisma.$transaction([
            prisma.user.update({ where: { id: userId }, data: { creditBalance: { increment: credits } } }),
            prisma.creditTransaction.create({
                data: {
                    id: ledgerId,
                    userId,
                    amount: credits,
                    type: "credit_purchase",
                    description: `Purchased ${credits} credits via ${settlement.provider} (${settlement.providerRef})`,
                },
            }),
        ]);
    } catch (error) {
        // P2002 is the unique constraint: the other delivery won the race.
        if (error && typeof error === "object" && "code" in error && (error as { code: unknown }).code === "P2002") {
            return ALREADY;
        }
        throw error;
    }

    return OK;
}

/** The buyer walked away, or the gateway's session expired. */
export async function voidOrder(reference: string): Promise<PaymentOutcome> {
    const order = await prisma.order.findUnique({ where: { id: reference } });
    if (!order) return failed("unknown order");
    // A paid order is never cancelled by a late "expired" event.
    if (order.status === "COMPLETED") return ALREADY;
    if (order.status === "CANCELLED") return ALREADY;
    await prisma.order.update({ where: { id: reference }, data: { status: "CANCELLED" } });
    return OK;
}

/** The money went back, whether the buyer asked or the operator did. */
export async function refundPayment(provider: string, providerRef: string): Promise<PaymentOutcome> {
    const payment = await prisma.payment.findFirst({ where: { provider, providerId: providerRef } });
    if (!payment) return failed("unknown payment");
    if (payment.status === "REFUNDED") return ALREADY;

    await prisma.$transaction([
        prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } }),
        prisma.order.update({ where: { id: payment.orderId }, data: { status: "REFUNDED" } }),
    ]);
    return OK;
}

/**
 * Records what a gateway says about a recurring plan.
 *
 * The store keeps the subscription row because access to the product is the
 * store's business; the gateway keeps the plan itself. An ended plan takes the
 * product with it, which is the whole point of selling access by the month.
 */
export async function applySubscriptionChange(change: SubscriptionChange): Promise<PaymentOutcome> {
    const existing = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: change.providerRef },
    });

    if (change.ended) {
        if (!existing) return failed("unknown subscription");
        if (existing.status === "canceled") return ALREADY;

        // Cancelling the plan and taking the product back are one step. Done
        // in sequence, a process that died between them left the plan
        // cancelled and the product still owned - and the guard above then
        // answered every retry with ALREADY, so the subscriber kept what they
        // had stopped paying for. The condition in the `where` is what makes
        // two "ended" events arriving together safe.
        const ended = await prisma.$transaction(async (tx) => {
            const claimed = await tx.subscription.updateMany({
                where: { id: existing.id, status: { not: "canceled" } },
                data: { status: "canceled", canceledAt: new Date() },
            });
            if (claimed.count === 0) return false;
            await tx.ownedProduct.deleteMany({
                where: { userId: existing.userId, productId: existing.productId },
            });
            return true;
        });
        return ended ? OK : ALREADY;
    }

    const periodEnd = change.currentPeriodEnd ? new Date(change.currentPeriodEnd) : null;

    if (existing) {
        await prisma.subscription.update({
            where: { id: existing.id },
            data: { status: change.status, ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}) },
        });
        return OK;
    }

    // Same again in the other direction: a new plan and the product it grants
    // arrive together or not at all. Written in sequence, a failure in between
    // left a subscription row with nothing granted, and the retry found that
    // row, took the branch above, and only updated its status - so the
    // subscriber paid every month for a product they never received.
    await prisma.$transaction(async (tx) => {
        await tx.subscription.create({
            data: {
                userId: change.userId,
                productId: change.productId,
                stripeSubscriptionId: change.providerRef,
                status: change.status,
                currentPeriodEnd: periodEnd ?? new Date(),
            },
        });
        await tx.ownedProduct.upsert({
            where: { userId_productId: { userId: change.userId, productId: change.productId } },
            update: {},
            create: { userId: change.userId, productId: change.productId },
        });
    });
    return OK;
}
