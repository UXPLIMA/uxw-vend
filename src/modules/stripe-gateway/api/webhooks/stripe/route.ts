import { NextRequest, NextResponse } from "next/server";
import { stripe } from "../../../lib/stripe";
import { prisma } from "@/core/lib/db";
import { sendOrderConfirmationEmail } from "@/core/lib/email";
import { notifyOrderCompleted } from "@/core/lib/discord";
import { deliverProduct } from "@/core/lib/rcon";
import Stripe from "stripe";

// Disable body parsing - Stripe needs raw body for signature verification
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET || ""
        );
    } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const orderId = session.metadata?.orderId;

            if (orderId) {
                // Update order status to COMPLETED
                await prisma.order.update({
                    where: { id: orderId },
                    data: {
                        status: "COMPLETED",
                        paymentMethod: "stripe",
                        paymentId: session.payment_intent as string,
                    },
                });

                // Send order confirmation email
                const order = await prisma.order.findUnique({
                    where: { id: orderId },
                    include: { user: { select: { email: true } } },
                });
                if (order) {
                    sendOrderConfirmationEmail(
                        order.user.email,
                        order.orderNumber,
                        Number(order.total)
                    ).catch(console.error);

                    // Discord notification
                    notifyOrderCompleted({
                        orderNumber: order.orderNumber,
                        total: Number(order.total),
                        username: order.user.email,
                        itemCount: 0,
                    }).catch(console.error);
                }

                // RCON: Deliver products to game server
                try {
                    const orderItems = await prisma.orderItem.findMany({
                        where: { orderId },
                        select: { productId: true, name: true, quantity: true },
                    });

                    for (const item of orderItems) {
                        if (!item.productId) continue;
                        const commands = await prisma.productCommand.findMany({
                            where: { productId: item.productId },
                            orderBy: { order: "asc" },
                        });

                        if (commands.length > 0) {
                            // Try to get player name from order metadata or username
                            const playerName = session.metadata?.playerName || session.customer_details?.name || "Player";

                            deliverProduct({
                                playerName,
                                productName: item.name,
                                commands: commands.map((c) => c.command),
                                quantity: item.quantity,
                            }).catch(console.error);
                        }
                    }
                } catch (e) {
                    console.error("[RCON Delivery]", e);
                }

                // Create Payment record
                await prisma.payment.create({
                    data: {
                        orderId,
                        provider: "stripe",
                        providerId: session.payment_intent as string,
                        amount: (session.amount_total || 0) / 100,
                        currency: session.currency || "usd",
                        status: "COMPLETED",
                        metadata: {
                            checkoutSessionId: session.id,
                            customerEmail: session.customer_details?.email,
                        },
                    },
                });
            }
            break;
        }

        case "checkout.session.expired": {
            const session = event.data.object as Stripe.Checkout.Session;
            const orderId = session.metadata?.orderId;

            if (orderId) {
                await prisma.order.update({
                    where: { id: orderId },
                    data: { status: "CANCELLED" },
                });
            }
            break;
        }

        case "charge.refunded": {
            const charge = event.data.object as Stripe.Charge;
            const paymentIntentId = charge.payment_intent as string;

            if (paymentIntentId) {
                const payment = await prisma.payment.findFirst({
                    where: { providerId: paymentIntentId },
                });

                if (payment) {
                    await prisma.order.update({
                        where: { id: payment.orderId },
                        data: { status: "REFUNDED" },
                    });

                    await prisma.payment.update({
                        where: { id: payment.id },
                        data: { status: "REFUNDED" },
                    });
                }
            }
            break;
        }
    }

    return NextResponse.json({ received: true });
}
