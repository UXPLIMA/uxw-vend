import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { stripe, getStripe, getStripeEnabled, getStripeWebhookSecret } from "../../lib/stripe";
import { generateOrderNumber } from "@/core/lib/utils";
import { sendDiscordWebhook } from "@/core/lib/discord";
import { logActivity } from "@/core/lib/activity-log";
import { deliverProduct } from "../../lib/rcon";
import {
    computeOrderPricing,
    computeCouponDiscount,
    computeCreatorDiscount,
    computeTotals,
} from "../../lib/pricing";
import { z } from "zod";

const checkoutSchema = z.object({
    items: z.array(z.object({
        productId: z.string({ message: "Product is missing" }),
        quantity: z.number().int().min(1, "Quantity must be at least 1"),
    }), { message: "Your cart is empty" }).min(1, "Your cart is empty"),
    playerName: z.string().min(1, "Player name is required").max(50, "Player name is too long"),
    couponCode: z.string().optional(),
    creatorCode: z.string().optional(),
    variables: z.record(z.string(), z.record(z.string(), z.string())).optional(),
    notes: z.string().optional(),
    paymentMethod: z.enum(["stripe", "credits"], { message: "Invalid payment method" }).default("stripe"),
});

// POST /api/v1/store/checkout - Create checkout session
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const validation = checkoutSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
        }

        const { items, playerName, couponCode, creatorCode, variables, notes, paymentMethod } = validation.data;

        // ── Fetch products ──
        const productIds = items.map((i) => i.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, isActive: true },
            include: { category: { select: { id: true } } },
        });

        if (products.length !== items.length) {
            return NextResponse.json({ error: "Some products are not available" }, { status: 400 });
        }

        // ── Check subscription constraints ──
        const subscriptionProducts = products.filter((p) => p.type === "SUBSCRIPTION");
        if (subscriptionProducts.length > 1) {
            return NextResponse.json({ error: "Only one subscription product per checkout is allowed" }, { status: 400 });
        }
        if (subscriptionProducts.length === 1 && items.length > 1) {
            return NextResponse.json({ error: "Subscription products must be purchased separately" }, { status: 400 });
        }
        const isSubscriptionCheckout = subscriptionProducts.length === 1;

        // Subscriptions cannot be paid with credits
        if (isSubscriptionCheckout && paymentMethod === "credits") {
            return NextResponse.json({ error: "Subscriptions cannot be paid with credits" }, { status: 400 });
        }

        // ── Validate product variables ──
        const allVariables = await prisma.productVariable.findMany({
            where: { productId: { in: productIds } },
        });
        for (const v of allVariables) {
            if (v.required) {
                const val = variables?.[v.productId]?.[v.name];
                if (!val || val.trim() === "") {
                    return NextResponse.json({
                        error: `${v.label} is required for product`,
                    }, { status: 400 });
                }
            }
        }

        // ── Fetch bulk discounts ──
        const bulkDiscounts = await prisma.bulkDiscount.findMany({
            where: { isActive: true },
            orderBy: { discountPercent: "desc" },
        });

        // ── Cumulative upgrade check ──
        const ownedProducts = await prisma.ownedProduct.findMany({
            where: { userId: session.user.id },
        });
        const ownedIds = new Set(ownedProducts.map((o) => o.productId));

        // ── Calculate item prices (with bulk discounts + cumulative upgrades) ──
        const { subtotal, orderItems } = computeOrderPricing({
            items,
            products: products.map((p) => ({
                id: p.id,
                name: p.name,
                type: p.type,
                price: Number(p.price),
                categoryId: p.categoryId,
            })),
            bulkDiscounts,
            ownedProductIds: ownedIds,
            variables,
        });

        // ── Apply coupon ──
        // If the user supplied a coupon code, reject the checkout with a
        // clear error when it doesn't apply (not found / inactive /
        // expired / usage cap / min-purchase). Previously an invalid
        // code was silently ignored — the customer paid full price with
        // no feedback that their code didn't work.
        let couponDiscount = 0;
        if (couponCode) {
            const couponError = await prisma.$transaction(async (tx): Promise<string | null> => {
                const coupon = await tx.coupon.findUnique({
                    where: { code: couponCode.toUpperCase() },
                });
                const { error, discount } = computeCouponDiscount(coupon, subtotal);
                if (error) return error;
                couponDiscount = discount;
                await tx.coupon.update({ where: { id: coupon!.id }, data: { usageCount: { increment: 1 } } });
                return null;
            });
            if (couponError) {
                return NextResponse.json({ error: couponError, code: "invalid_coupon" }, { status: 400 });
            }
        }

        // ── Apply creator code ──
        let creatorDiscount = 0;
        let creatorCodeRecord: { id: string; code: string; creatorId: string; commissionPercent: number } | null = null;
        if (creatorCode) {
            const code = await prisma.creatorCode.findUnique({
                where: { code: creatorCode.toUpperCase() },
            });
            // Skip codes whose creator was deleted (creatorId becomes null on
            // user delete via SetNull); the discount + commission both require
            // a payable creator.
            if (code && code.isActive && code.creatorId && code.creatorId !== session.user.id) {
                creatorCodeRecord = {
                    id: code.id,
                    code: code.code,
                    creatorId: code.creatorId,
                    commissionPercent: code.commissionPercent,
                };
                creatorDiscount = computeCreatorDiscount(subtotal, couponDiscount, code.discountPercent);
            }
        }

        // ── Tax calculation ──
        const taxSetting = await prisma.setting.findUnique({ where: { key: "tax_rate" } });
        const taxRate = Number(taxSetting?.value) || 0;
        const currSetting = await prisma.setting.findUnique({ where: { key: "default_currency" } });
        const currency = ((currSetting?.value as string) || "usd").toLowerCase();

        const { totalDiscount, tax, total } = computeTotals({
            subtotal,
            couponDiscount,
            creatorDiscount,
            taxRate,
        });

        // ── Credits payment ──
        if (paymentMethod === "credits") {
            const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { creditBalance: true } });
            const balance = Number(user?.creditBalance || 0);

            if (balance < total) {
                return NextResponse.json({
                    error: `Insufficient credit balance. You have ${balance.toFixed(2)} credits but need ${total.toFixed(2)}.`,
                }, { status: 400 });
            }

            // Atomic transaction: deduct credits, create order, grant ownership
            const order = await prisma.$transaction(async (tx) => {
                // Deduct credits
                await tx.user.update({
                    where: { id: session.user.id },
                    data: { creditBalance: { decrement: total } },
                });

                // Create credit transaction
                await tx.creditTransaction.create({
                    data: {
                        userId: session.user.id,
                        amount: -total,
                        type: "purchase",
                        description: `Store purchase (${orderItems.map((i) => i.name).join(", ")})`,
                    },
                });

                // Create order
                const ord = await tx.order.create({
                    data: {
                        orderNumber: generateOrderNumber(),
                        userId: session.user.id,
                        status: "COMPLETED",
                        subtotal,
                        discount: totalDiscount,
                        tax,
                        total,
                        currency: currency.toUpperCase(),
                        notes,
                        paymentMethod: "credits",
                        metadata: { playerName, variables: variables || {}, creatorCode: creatorCodeRecord?.code || null },
                        items: { create: orderItems },
                    },
                });

                // Grant ownership
                for (const item of orderItems) {
                    await tx.chestItem.create({
                        data: { userId: session.user.id, productId: item.productId, productName: item.name, quantity: item.quantity, orderId: ord.id },
                    });
                    await tx.ownedProduct.upsert({
                        where: { userId_productId: { userId: session.user.id, productId: item.productId } },
                        update: {},
                        create: { userId: session.user.id, productId: item.productId, orderId: ord.id },
                    });
                }

                return ord;
            });

            // ── RCON delivery for credits payment ──
            for (const item of orderItems) {
                if (!item.productId) continue;
                const commands = await prisma.productCommand.findMany({
                    where: { productId: item.productId },
                    orderBy: { order: "asc" },
                });
                if (commands.length > 0) {
                    const itemVars = (item.metadata as Record<string, unknown>)?.variables as Record<string, string> | undefined;
                    deliverProduct({
                        playerName,
                        productName: item.name,
                        commands: commands.map((c) => ({ command: c.command, serverId: c.serverId })),
                        quantity: item.quantity,
                        variables: itemVars,
                    }).catch(console.error);
                }
            }

            // ── Update creator code stats ──
            if (creatorCodeRecord) {
                await prisma.$transaction([
                    prisma.creatorCode.update({
                        where: { id: creatorCodeRecord.id },
                        data: { usageCount: { increment: 1 }, totalRevenue: { increment: total } },
                    }),
                    prisma.user.update({
                        where: { id: creatorCodeRecord.creatorId },
                        data: { creditBalance: { increment: total * creatorCodeRecord.commissionPercent / 100 } },
                    }),
                    prisma.creditTransaction.create({
                        data: {
                            userId: creatorCodeRecord.creatorId,
                            amount: total * creatorCodeRecord.commissionPercent / 100,
                            type: "creator_commission",
                            description: `Commission for order ${order.orderNumber} via code ${creatorCodeRecord.code}`,
                        },
                    }),
                ]);
            }

            // ── Clear cart ──
            await prisma.cartItem.deleteMany({ where: { userId: session.user.id } });

            // ── Audit log + Discord ──
            logActivity({
                userId: session.user.id,
                action: "order.created",
                entity: "order",
                entityId: order.id,
                metadata: { orderNumber: order.orderNumber, total, paymentMethod: "credits" },
            }).catch(console.error);

            sendDiscordWebhook("order_completed", {
                embeds: [{
                    title: "Order Completed (Credits)",
                    color: 0x22c55e,
                    fields: [
                        { name: "Order", value: order.orderNumber, inline: true },
                        { name: "Total", value: `${total.toFixed(2)} credits`, inline: true },
                        { name: "Player", value: playerName, inline: true },
                    ],
                    timestamp: new Date().toISOString(),
                }],
            }).catch(console.error);

            const { doActionAsync } = await import("@/core/lib/hooks");
            await doActionAsync("store.order.created", order);
            await doActionAsync("store.order.completed", order);
            return NextResponse.json({ order, redirect: null, message: "Order completed with credits" }, { status: 201 });
        }

        // ── Create order (PENDING -- NO ownership granted yet) ──
        const order = await prisma.order.create({
            data: {
                orderNumber: generateOrderNumber(),
                userId: session.user.id,
                status: "PENDING",
                subtotal,
                discount: totalDiscount,
                tax,
                total,
                currency: currency.toUpperCase(),
                notes,
                paymentMethod: "stripe",
                metadata: { playerName, variables: variables || {}, creatorCode: creatorCodeRecord?.code || null },
                items: { create: orderItems },
            },
        });

        // ── Update creator code stats ──
        if (creatorCodeRecord) {
            await prisma.$transaction([
                prisma.creatorCode.update({
                    where: { id: creatorCodeRecord.id },
                    data: { usageCount: { increment: 1 }, totalRevenue: { increment: total } },
                }),
                prisma.user.update({
                    where: { id: creatorCodeRecord.creatorId },
                    data: { creditBalance: { increment: total * creatorCodeRecord.commissionPercent / 100 } },
                }),
                prisma.creditTransaction.create({
                    data: {
                        userId: creatorCodeRecord.creatorId,
                        amount: total * creatorCodeRecord.commissionPercent / 100,
                        type: "creator_commission",
                        description: `Commission for order ${order.orderNumber} via code ${creatorCodeRecord.code}`,
                    },
                }),
            ]);
        }

        // ── Clear cart ──
        await prisma.cartItem.deleteMany({ where: { userId: session.user.id } });

        // ── Audit log + Discord ──
        logActivity({
            userId: session.user.id,
            action: "order.created",
            entity: "order",
            entityId: order.id,
            metadata: { orderNumber: order.orderNumber, total },
        }).catch(console.error);

        sendDiscordWebhook("order_created", {
            embeds: [{
                title: "New Order",
                color: 0x3b82f6,
                fields: [
                    { name: "Order", value: order.orderNumber, inline: true },
                    { name: "Total", value: `${total.toFixed(2)} ${currency.toUpperCase()}`, inline: true },
                    { name: "Player", value: playerName, inline: true },
                ],
                timestamp: new Date().toISOString(),
            }],
        }).catch(console.error);

        // ── Free order: complete & grant immediately ──
        // CRITICAL: separated from the "Stripe missing" path. If a paid order
        // arrives but Stripe isn't configured, refuse it (503) instead of
        // silently giving the product away. Previously both conditions were
        // OR'd together, which let any paid checkout succeed for free when
        // STRIPE_SECRET_KEY was unset.
        if (total <= 0) {
            await prisma.order.update({ where: { id: order.id }, data: { status: "COMPLETED" } });

            for (const item of orderItems) {
                await prisma.chestItem.create({
                    data: { userId: session.user.id, productId: item.productId, productName: item.name, quantity: item.quantity, orderId: order.id },
                });
                await prisma.ownedProduct.upsert({
                    where: { userId_productId: { userId: session.user.id, productId: item.productId } },
                    update: {},
                    create: { userId: session.user.id, productId: item.productId, orderId: order.id },
                });
            }

            const { doActionAsync } = await import("@/core/lib/hooks");
            await doActionAsync("store.order.created", order);
            await doActionAsync("store.order.completed", order);
            return NextResponse.json({ order, redirect: null, message: "Order completed (free)" }, { status: 201 });
        }

        // Paid order but Stripe isn't wired — keep the order PENDING and tell
        // the caller. Do NOT grant ownership.
        if (!await getStripeEnabled()) {
            return NextResponse.json(
                { error: "Payments are not configured. Ask an administrator to set up Stripe before purchasing.", code: "payment_not_configured" },
                { status: 503 },
            );
        }

        // ── Create Stripe Checkout Session ──
        const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3001";

        // ── Subscription checkout flow ──
        if (isSubscriptionCheckout) {
            const subProduct = subscriptionProducts[0];
            const subItem = items[0];

            // Get or create Stripe customer
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { stripeCustomerId: true, email: true, username: true },
            });

            let customerId = user?.stripeCustomerId;
            if (!customerId) {
                const customer = await (await getStripe()).customers.create({
                    email: user?.email || undefined,
                    name: user?.username || undefined,
                    metadata: { userId: session.user.id },
                });
                customerId = customer.id;
                await prisma.user.update({
                    where: { id: session.user.id },
                    data: { stripeCustomerId: customerId },
                });
            }

            // Get or create Stripe price
            let priceId = subProduct.stripePriceId;
            if (!priceId) {
                const interval = (subProduct.subscriptionInterval as "month" | "year") || "month";
                const intervalCount = subProduct.subscriptionIntervalCount || 1;

                const stripePrice = await (await getStripe()).prices.create({
                    unit_amount: Math.round(Number(subProduct.price) * 100),
                    currency,
                    recurring: {
                        interval,
                        interval_count: intervalCount,
                    },
                    product_data: { name: subProduct.name },
                });
                priceId = stripePrice.id;

                // Save the price ID back for reuse
                await prisma.product.update({
                    where: { id: subProduct.id },
                    data: { stripePriceId: priceId },
                });
            }

            const subParams: Record<string, unknown> = {
                mode: "subscription",
                customer: customerId,
                payment_method_types: ["card"],
                line_items: [{ price: priceId, quantity: subItem.quantity }],
                metadata: { orderId: order.id, userId: session.user.id, productId: subProduct.id, playerName },
                subscription_data: {
                    metadata: { orderId: order.id, userId: session.user.id, productId: subProduct.id, playerName },
                },
                success_url: `${baseUrl}/store/order-success`,
                cancel_url: `${baseUrl}/store/cart?order=cancelled`,
            };

            if (totalDiscount > 0) {
                const stripeCoupon = await (await getStripe()).coupons.create({
                    amount_off: Math.round(totalDiscount * 100),
                    currency,
                    duration: "once",
                });
                subParams.discounts = [{ coupon: stripeCoupon.id }];
            }

            const stripeClient = await getStripe();
            const checkoutSession = await stripeClient.checkout.sessions.create(
                subParams as Parameters<typeof stripeClient.checkout.sessions.create>[0]
            );

            await prisma.order.update({
                where: { id: order.id },
                data: { paymentId: checkoutSession.id },
            });

            return NextResponse.json({ order, redirect: checkoutSession.url }, { status: 201 });
        }

        // ── Standard payment checkout flow ──
        const lineItems = orderItems.map((item) => ({
            price_data: {
                currency,
                product_data: { name: item.name },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
        }));

        // Tax as separate line item
        if (tax > 0) {
            lineItems.push({
                price_data: {
                    currency,
                    product_data: { name: `Tax (${taxRate}%)` },
                    unit_amount: Math.round(tax * 100),
                },
                quantity: 1,
            });
        }

        // Discount via Stripe coupon (not negative line item -- Stripe rejects those)
        const stripeParams: Record<string, unknown> = {
            mode: "payment",
            payment_method_types: ["card"],
            line_items: lineItems,
            metadata: { orderId: order.id, userId: session.user.id, playerName },
            success_url: `${baseUrl}/store/order-success`,
            cancel_url: `${baseUrl}/store/cart?order=cancelled`,
        };

        if (totalDiscount > 0) {
            const stripeCoupon = await (await getStripe()).coupons.create({
                amount_off: Math.round(totalDiscount * 100),
                currency,
                duration: "once",
            });
            stripeParams.discounts = [{ coupon: stripeCoupon.id }];
        }

        const stripeClient = await getStripe();
        const checkoutSession = await stripeClient.checkout.sessions.create(stripeParams as Parameters<typeof stripeClient.checkout.sessions.create>[0]);

        await prisma.order.update({
            where: { id: order.id },
            data: { paymentId: checkoutSession.id },
        });

        return NextResponse.json({ order, redirect: checkoutSession.url }, { status: 201 });
    } catch (error) {
        console.error("Checkout error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
