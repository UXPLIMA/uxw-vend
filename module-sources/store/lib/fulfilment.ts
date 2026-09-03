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
import { sendOrderConfirmationEmail } from "./email";
import { deliverProduct } from "./delivery";
import { announceOrderCompleted } from "./order-events";

const OK: PaymentOutcome = { handled: true, duplicate: false, error: null };
const ALREADY: PaymentOutcome = { handled: true, duplicate: true, error: null };

function failed(error: string): PaymentOutcome {
    return { handled: true, duplicate: false, error };
}

/**
 * Settles an order.
 *
 * Ownership is granted here and nowhere earlier: an order is created PENDING
 * at checkout and stays that way until a gateway says it was paid for.
 */
export async function settleOrder(settlement: PaymentSettlement): Promise<PaymentOutcome> {
    const existing = await prisma.order.findUnique({ where: { id: settlement.reference } });
    if (!existing) return failed("unknown order");
    // Webhooks retry, and a buyer can reload a return URL. Both arrive here.
    if (existing.status === "COMPLETED") return ALREADY;

    await prisma.order.update({
        where: { id: existing.id },
        data: {
            status: "COMPLETED",
            paymentMethod: settlement.provider,
            paymentId: settlement.providerRef,
        },
    });

    const order = await prisma.order.findUnique({
        where: { id: existing.id },
        include: { user: { select: { email: true, username: true } }, items: true },
    });
    if (!order) return failed("order vanished mid-settlement");

    // Order.userId is nullable: the account can be deleted between paying and
    // the webhook landing. The order is still paid, so it stays COMPLETED, but
    // there is nobody left to grant anything to.
    if (!order.userId || !order.user) {
        log.warn("[store] order paid for by an account that no longer exists", { orderId: order.id });
        await recordPayment(settlement);
        return OK;
    }

    const buyerId = order.userId;
    const buyer = order.user;

    for (const item of order.items) {
        if (!item.productId) continue;
        await prisma.chestItem.create({
            data: {
                userId: buyerId,
                productId: item.productId,
                productName: item.name,
                quantity: item.quantity,
                orderId: order.id,
            },
        });
        await prisma.ownedProduct.upsert({
            where: { userId_productId: { userId: buyerId, productId: item.productId } },
            update: {},
            create: { userId: buyerId, productId: item.productId, orderId: order.id },
        });
    }

    await recordPayment(settlement);

    // Neither of these may hold up the answer to the gateway: the order is
    // paid and granted either way, and a webhook left waiting gets retried.
    sendOrderConfirmationEmail(buyer.email, order.orderNumber, Number(order.total)).catch((error) =>
        log.error("[store] order confirmation email failed", { orderId: order.id, error: String(error) }),
    );

    const playerName =
        settlement.metadata?.playerName ||
        ((order.metadata as Record<string, unknown>)?.playerName as string) ||
        buyer.username ||
        "Player";

    for (const item of order.items) {
        if (!item.productId) continue;
        const commands = await prisma.productCommand.findMany({
            where: { productId: item.productId },
            orderBy: { order: "asc" },
        });
        if (commands.length === 0) continue;

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

async function recordPayment(settlement: PaymentSettlement): Promise<void> {
    await prisma.payment.create({
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

    // The provider's own id for the money is unique, so a retried webhook
    // finds the transaction it already wrote.
    const already = await prisma.creditTransaction.findFirst({
        where: { userId, type: "credit_purchase", description: { contains: settlement.providerRef } },
    });
    if (already) return ALREADY;

    await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { creditBalance: { increment: credits } } }),
        prisma.creditTransaction.create({
            data: {
                userId,
                amount: credits,
                type: "credit_purchase",
                description: `Purchased ${credits} credits via ${settlement.provider} (${settlement.providerRef})`,
            },
        }),
    ]);

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
        await prisma.subscription.update({
            where: { id: existing.id },
            data: { status: "canceled", canceledAt: new Date() },
        });
        await prisma.ownedProduct.deleteMany({
            where: { userId: existing.userId, productId: existing.productId },
        });
        return OK;
    }

    const periodEnd = change.currentPeriodEnd ? new Date(change.currentPeriodEnd) : null;

    if (existing) {
        await prisma.subscription.update({
            where: { id: existing.id },
            data: { status: change.status, ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}) },
        });
        return OK;
    }

    await prisma.subscription.create({
        data: {
            userId: change.userId,
            productId: change.productId,
            stripeSubscriptionId: change.providerRef,
            status: change.status,
            currentPeriodEnd: periodEnd ?? new Date(),
        },
    });
    await prisma.ownedProduct.upsert({
        where: { userId_productId: { userId: change.userId, productId: change.productId } },
        update: {},
        create: { userId: change.userId, productId: change.productId },
    });
    return OK;
}
