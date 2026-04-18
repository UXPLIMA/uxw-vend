import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { stripe, getStripeEnabled } from "../../lib/stripe";
import { generateOrderNumber } from "@/core/lib/utils";
import { sendDiscordWebhook } from "@/core/lib/discord";
import { logActivity } from "@/core/lib/activity-log";
import { deliverProduct } from "../../lib/rcon";
import { z } from "zod";

const checkoutSchema = z.object({
    items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().min(1),
    })).min(1),
    playerName: z.string().min(1, "Player name is required").max(50),
    couponCode: z.string().optional(),
    creatorCode: z.string().optional(),
    variables: z.record(z.string(), z.record(z.string(), z.string())).optional(),
    notes: z.string().optional(),
    paymentMethod: z.enum(["stripe", "credits"]).default("stripe"),
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
        let subtotal = 0;
        const orderItems = items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            let price = Number(product.price);

            // Cumulative upgrade: pay difference if user owns cheaper in same category
            if (product.categoryId) {
                const ownedInCategory = products.filter(
                    (p) => p.categoryId === product.categoryId && ownedIds.has(p.id) && Number(p.price) < price
                );
                if (ownedInCategory.length > 0) {
                    const highestOwned = Math.max(...ownedInCategory.map((p) => Number(p.price)));
                    price = Math.max(0, price - highestOwned);
                }
            }

            // Bulk discount: find best matching discount for this item
            const matchingBulk = bulkDiscounts.find((bd) =>
                bd.minQuantity <= item.quantity &&
                (bd.productId === product.id || bd.categoryId === product.categoryId || (!bd.productId && !bd.categoryId))
            );
            let bulkDiscountApplied = 0;
            if (matchingBulk) {
                bulkDiscountApplied = matchingBulk.discountPercent;
                price = price * (1 - matchingBulk.discountPercent / 100);
            }

            const itemTotal = price * item.quantity;
            subtotal += itemTotal;

            return {
                productId: product.id,
                name: product.name,
                price,
                quantity: item.quantity,
                metadata: {
                    type: product.type,
                    variables: variables?.[product.id] || {},
                    ...(bulkDiscountApplied > 0 ? { bulkDiscount: bulkDiscountApplied } : {}),
                },
            };
        });

        // ── Apply coupon ──
        let couponDiscount = 0;
        if (couponCode) {
            await prisma.$transaction(async (tx) => {
                const coupon = await tx.coupon.findUnique({
                    where: { code: couponCode.toUpperCase() },
                });
                if (coupon && coupon.isActive) {
                    const now = new Date();
                    const valid = (!coupon.startsAt || coupon.startsAt <= now) &&
                        (!coupon.expiresAt || coupon.expiresAt >= now) &&
                        (!coupon.usageLimit || coupon.usageCount < coupon.usageLimit) &&
                        (!coupon.minPurchase || subtotal >= Number(coupon.minPurchase));

                    if (valid) {
                        if (coupon.type === "PERCENTAGE") {
                            couponDiscount = subtotal * (Number(coupon.value) / 100);
                            if (coupon.maxDiscount) couponDiscount = Math.min(couponDiscount, Number(coupon.maxDiscount));
                        } else {
                            couponDiscount = Math.min(Number(coupon.value), subtotal);
                        }
                        await tx.coupon.update({ where: { id: coupon.id }, data: { usageCount: { increment: 1 } } });
                    }
                }
            });
        }

        // ── Apply creator code ──
        let creatorDiscount = 0;
        let creatorCodeRecord: { id: string; code: string; creatorId: string; commissionPercent: number } | null = null;
        if (creatorCode) {
            const code = await prisma.creatorCode.findUnique({
                where: { code: creatorCode.toUpperCase() },
            });
            if (code && code.isActive && code.creatorId !== session.user.id) {
                creatorCodeRecord = code;
                const afterCoupon = subtotal - couponDiscount;
                creatorDiscount = afterCoupon * (code.discountPercent / 100);
            }
        }

        // ── Tax calculation ──
        const taxSetting = await prisma.setting.findUnique({ where: { key: "tax_rate" } });
        const taxRate = Number(taxSetting?.value) || 0;
        const currSetting = await prisma.setting.findUnique({ where: { key: "default_currency" } });
        const currency = ((currSetting?.value as string) || "usd").toLowerCase();

        const totalDiscount = couponDiscount + creatorDiscount;
        const taxableAmount = Math.max(0, subtotal - totalDiscount);
        const tax = taxRate > 0 ? Math.round(taxableAmount * taxRate) / 100 : 0;
        const total = Math.max(0, taxableAmount + tax);

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

        // ── Free checkout / Stripe not configured ──
        if (!getStripeEnabled() || total <= 0) {
            await prisma.order.update({ where: { id: order.id }, data: { status: "COMPLETED" } });

            // Grant ownership immediately for free orders
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
                const customer = await stripe.customers.create({
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

                const stripePrice = await stripe.prices.create({
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
                const stripeCoupon = await stripe.coupons.create({
                    amount_off: Math.round(totalDiscount * 100),
                    currency,
                    duration: "once",
                });
                subParams.discounts = [{ coupon: stripeCoupon.id }];
            }

            const checkoutSession = await stripe.checkout.sessions.create(
                subParams as Parameters<typeof stripe.checkout.sessions.create>[0]
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
            const stripeCoupon = await stripe.coupons.create({
                amount_off: Math.round(totalDiscount * 100),
                currency,
                duration: "once",
            });
            stripeParams.discounts = [{ coupon: stripeCoupon.id }];
        }

        const checkoutSession = await stripe.checkout.sessions.create(stripeParams as Parameters<typeof stripe.checkout.sessions.create>[0]);

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
