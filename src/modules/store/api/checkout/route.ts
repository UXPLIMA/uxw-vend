import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { stripe, getStripeEnabled } from "@/core/lib/stripe";
import { generateOrderNumber } from "@/core/lib/utils";
import { notifyOrderCreated } from "@/core/lib/discord";
import { logActivity } from "@/core/lib/activity-log";
import { z } from "zod";

const checkoutSchema = z.object({
    items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().min(1),
    })).min(1),
    couponCode: z.string().optional(),
    notes: z.string().optional(),
});

// POST /api/v1/store/checkout - Create Stripe checkout session
export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const validation = checkoutSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }

        const { items, couponCode, notes } = validation.data;

        // Fetch products
        const productIds = items.map((i) => i.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, isActive: true },
        });

        if (products.length !== items.length) {
            return NextResponse.json(
                { error: "Some products are not available" },
                { status: 400 }
            );
        }

        // Check for cumulative upgrades (if user owns a cheaper product in same category, pay difference)
        const ownedProducts = await prisma.ownedProduct.findMany({
            where: { userId: session.user.id },
        });
        const ownedIds = new Set(ownedProducts.map((o) => o.productId));

        // Calculate totals
        let subtotal = 0;
        const orderItems = items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            let price = Number(product.price);

            // Cumulative: if same category and user owns a cheaper product, pay difference
            if (product.categoryId) {
                const ownedInCategory = products.filter(
                    (p) => p.categoryId === product.categoryId && ownedIds.has(p.id) && Number(p.price) < price
                );
                if (ownedInCategory.length > 0) {
                    const highestOwned = Math.max(...ownedInCategory.map((p) => Number(p.price)));
                    price = Math.max(0, price - highestOwned);
                }
            }

            const itemTotal = price * item.quantity;
            subtotal += itemTotal;

            return {
                productId: product.id,
                name: product.name,
                price: price,
                quantity: item.quantity,
                metadata: { type: product.type },
            };
        });

        // Apply coupon
        let discount = 0;
        if (couponCode) {
            const coupon = await prisma.coupon.findUnique({
                where: { code: couponCode.toUpperCase() },
            });

            if (coupon && coupon.isActive) {
                const now = new Date();
                const validStart = !coupon.startsAt || coupon.startsAt <= now;
                const validEnd = !coupon.expiresAt || coupon.expiresAt >= now;
                const validUsage = !coupon.usageLimit || coupon.usageCount < coupon.usageLimit;
                const validMin = !coupon.minPurchase || subtotal >= Number(coupon.minPurchase);

                if (validStart && validEnd && validUsage && validMin) {
                    if (coupon.type === "PERCENTAGE") {
                        discount = subtotal * (Number(coupon.value) / 100);
                        if (coupon.maxDiscount) {
                            discount = Math.min(discount, Number(coupon.maxDiscount));
                        }
                    } else {
                        discount = Number(coupon.value);
                    }

                    await prisma.coupon.update({
                        where: { id: coupon.id },
                        data: { usageCount: { increment: 1 } },
                    });
                }
            }
        }

        const total = subtotal - discount;

        // Create order in PENDING state
        const order = await prisma.order.create({
            data: {
                orderNumber: generateOrderNumber(),
                userId: session.user.id,
                status: "PENDING",
                subtotal,
                discount,
                total,
                notes,
                paymentMethod: "stripe",
                items: {
                    create: orderItems,
                },
            },
        });

        // Clear cart
        await prisma.cartItem.deleteMany({
            where: { userId: session.user.id },
        });

        // Add items to chest and owned products
        for (const item of orderItems) {
            await prisma.chestItem.create({
                data: {
                    userId: session.user.id,
                    productId: item.productId,
                    productName: item.name,
                    quantity: item.quantity,
                    orderId: order.id,
                },
            });
            await prisma.ownedProduct.upsert({
                where: { userId_productId: { userId: session.user.id, productId: item.productId } },
                update: {},
                create: { userId: session.user.id, productId: item.productId, orderId: order.id },
            });
        }

        // Audit log
        logActivity({
            userId: session.user.id,
            action: "order.created",
            entity: "order",
            entityId: order.id,
            metadata: { orderNumber: order.orderNumber, total },
        }).catch(console.error);

        // Discord notification
        notifyOrderCreated({
            orderNumber: order.orderNumber,
            total,
            username: session.user.name || session.user.email || "Unknown",
        }).catch(console.error);

        // If Stripe is not configured, return order directly (free checkout / dev mode)
        if (!getStripeEnabled()) {
            // Auto-complete for dev/testing
            await prisma.order.update({
                where: { id: order.id },
                data: { status: "COMPLETED" },
            });

            return NextResponse.json({
                order,
                redirect: null,
                message: "Order created (Stripe not configured, auto-completed)",
            }, { status: 201 });
        }

        // Create Stripe Checkout Session
        const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

        const lineItems = items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            return {
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: product.name,
                        ...(product.image ? { images: [product.image] } : {}),
                    },
                    unit_amount: Math.round(Number(product.price) * 100),
                },
                quantity: item.quantity,
            };
        });

        // Add discount as negative line item if applicable
        if (discount > 0) {
            lineItems.push({
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: `Coupon: ${couponCode}`,
                    },
                    unit_amount: -Math.round(discount * 100),
                },
                quantity: 1,
            });
        }

        const checkoutSession = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: lineItems,
            metadata: {
                orderId: order.id,
                userId: session.user.id,
            },
            success_url: `${baseUrl}/store/order-success`,
            cancel_url: `${baseUrl}/store/cart?order=cancelled`,
        });

        // Save Stripe session ID
        await prisma.order.update({
            where: { id: order.id },
            data: { paymentId: checkoutSession.id },
        });

        return NextResponse.json({
            order,
            redirect: checkoutSession.url,
        }, { status: 201 });
    } catch (error) {
        console.error("Checkout error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
