import { NextRequest, NextResponse } from "next/server";
import { getStripe, getStripeWebhookSecret } from "../../../lib/stripe";
import { prisma } from "@/core/lib/db";
import { sendOrderConfirmationEmail } from "../../../lib/email";
import { sendDiscordWebhook } from "@/core/lib/discord";
import { deliverProduct } from "../../../lib/rcon";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
        const stripeClient = await getStripe();
        const whSecret = (await getStripeWebhookSecret()) || "";
        event = stripeClient.webhooks.constructEvent(body, signature, whSecret);
    } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;

            // ── Credit purchase flow ──
            if (session.metadata?.type === "credit_purchase") {
                const userId = session.metadata.userId;
                const creditAmount = parseFloat(session.metadata.creditAmount || "0");

                if (userId && creditAmount > 0) {
                    await prisma.user.update({
                        where: { id: userId },
                        data: { creditBalance: { increment: creditAmount } },
                    });
                    await prisma.creditTransaction.create({
                        data: {
                            userId,
                            amount: creditAmount,
                            type: "credit_purchase",
                            description: `Purchased ${creditAmount} credits via Stripe`,
                        },
                    });
                }
                break;
            }

            // ── Standard order flow ──
            const orderId = session.metadata?.orderId;
            if (!orderId) break;

            // Idempotency check
            const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
            if (!existingOrder || existingOrder.status === "COMPLETED") {
                return NextResponse.json({ received: true });
            }

            // Update order status
            await prisma.order.update({
                where: { id: orderId },
                data: { status: "COMPLETED", paymentMethod: "stripe", paymentId: session.payment_intent as string },
            });

            // Fetch full order with items
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    user: { select: { email: true, username: true } },
                    items: true,
                },
            });
            if (!order) break;
            // Order.userId is nullable (SetNull on user deletion) but at this
            // point in the checkout flow the row was just paid for — if the
            // user has already been deleted there's nothing to deliver.
            if (!order.userId || !order.user) {
                console.warn(`[stripe] Order ${order.id} completed but user is null — skipping ownership grant`);
                break;
            }
            const buyerId = order.userId;
            const buyer = order.user;

            // ── Grant ownership (moved from checkout -- only after payment confirmed) ──
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

            // ── Send confirmation email ──
            sendOrderConfirmationEmail(buyer.email, order.orderNumber, Number(order.total)).catch(console.error);

            // ── Discord notification ──
            sendDiscordWebhook("order_completed", {
                embeds: [{
                    title: "Order Completed",
                    color: 0x22c55e,
                    fields: [
                        { name: "Order", value: order.orderNumber, inline: true },
                        { name: "Total", value: `${Number(order.total)} ${order.currency}`, inline: true },
                        { name: "User", value: buyer.username || buyer.email, inline: true },
                    ],
                    timestamp: new Date().toISOString(),
                }],
            }).catch(console.error);

            // ── RCON delivery ──
            const playerName = session.metadata?.playerName
                || (order.metadata as Record<string, unknown>)?.playerName as string
                || buyer.username
                || "Player";

            for (const item of order.items) {
                if (!item.productId) continue;
                const commands = await prisma.productCommand.findMany({
                    where: { productId: item.productId },
                    orderBy: { order: "asc" },
                });
                if (commands.length === 0) continue;

                // Extract per-item variables from metadata
                const itemVars = (item.metadata as Record<string, unknown>)?.variables as Record<string, string> | undefined;

                deliverProduct({
                    playerName,
                    productName: item.name,
                    commands: commands.map((c) => ({ command: c.command, serverId: c.serverId })),
                    quantity: item.quantity,
                    variables: itemVars,
                }).catch(console.error);
            }

            // ── Payment record ──
            await prisma.payment.create({
                data: {
                    orderId,
                    provider: "stripe",
                    providerId: session.payment_intent as string,
                    amount: (session.amount_total || 0) / 100,
                    currency: session.currency || "usd",
                    status: "COMPLETED",
                    metadata: { checkoutSessionId: session.id, customerEmail: session.customer_details?.email },
                },
            });
            break;
        }

        case "checkout.session.expired": {
            const session = event.data.object as Stripe.Checkout.Session;
            const orderId = session.metadata?.orderId;
            if (orderId) {
                await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
            }
            break;
        }

        case "charge.refunded": {
            const charge = event.data.object as Stripe.Charge;
            const paymentIntentId = charge.payment_intent as string;
            if (paymentIntentId) {
                const payment = await prisma.payment.findFirst({ where: { providerId: paymentIntentId } });
                if (payment) {
                    await prisma.order.update({ where: { id: payment.orderId }, data: { status: "REFUNDED" } });
                    await prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
                }
            }
            break;
        }

        // ── Subscription webhook handlers ──

        case "customer.subscription.created": {
            const sub = event.data.object as Stripe.Subscription;
            const userId = sub.metadata?.userId;
            const productId = sub.metadata?.productId;
            if (userId && productId) {
                await prisma.subscription.create({
                    data: {
                        userId,
                        productId,
                        stripeSubscriptionId: sub.id,
                        status: sub.status,
                        currentPeriodEnd: new Date((sub as unknown as Record<string, number>).current_period_end * 1000),
                    },
                });
                // Grant ownership
                await prisma.ownedProduct.upsert({
                    where: { userId_productId: { userId, productId } },
                    update: {},
                    create: { userId, productId },
                });
            }
            break;
        }

        case "customer.subscription.updated": {
            const sub = event.data.object as Stripe.Subscription;
            await prisma.subscription.updateMany({
                where: { stripeSubscriptionId: sub.id },
                data: {
                    status: sub.status,
                    currentPeriodEnd: new Date((sub as unknown as Record<string, number>).current_period_end * 1000),
                    ...((sub as unknown as Record<string, number>).canceled_at ? { canceledAt: new Date((sub as unknown as Record<string, number>).canceled_at * 1000) } : {}),
                },
            });
            break;
        }

        case "customer.subscription.deleted": {
            const sub = event.data.object as Stripe.Subscription;
            const dbSub = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
            if (dbSub) {
                await prisma.subscription.update({
                    where: { id: dbSub.id },
                    data: { status: "canceled", canceledAt: new Date() },
                });
                // Revoke ownership
                await prisma.ownedProduct.deleteMany({
                    where: { userId: dbSub.userId, productId: dbSub.productId },
                });
            }
            break;
        }

        case "invoice.payment_succeeded": {
            const invoice = event.data.object as Stripe.Invoice;
            const invoiceSubId = (invoice as unknown as Record<string, unknown>).subscription as string | null;
            if (invoiceSubId) {
                const sub = await prisma.subscription.findUnique({
                    where: { stripeSubscriptionId: invoiceSubId },
                });
                if (sub) {
                    await prisma.payment.create({
                        data: {
                            orderId: sub.id,
                            provider: "stripe",
                            providerId: (invoice as unknown as Record<string, unknown>).payment_intent as string,
                            amount: (invoice.amount_paid || 0) / 100,
                            currency: invoice.currency || "usd",
                            status: "COMPLETED",
                        },
                    });
                }
            }
            break;
        }
    }

    return NextResponse.json({ received: true });
}
