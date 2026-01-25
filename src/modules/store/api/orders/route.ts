import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { generateOrderNumber } from "@/core/lib/utils";
import { isAdmin } from "@/core/lib/permissions";
import { z } from "zod";

const checkoutSchema = z.object({
    items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().min(1),
    })).min(1),
    couponCode: z.string().optional(),
    notes: z.string().optional(),
});

// GET /api/v1/store/orders - List orders
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");

        const adminCheck = await isAdmin(session.user.id);

        // Admin sees all orders, users see only their own
        const where = adminCheck ? {} : { userId: session.user.id };

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    user: {
                        select: { id: true, username: true, email: true, avatar: true },
                    },
                    items: {
                        include: {
                            product: {
                                select: { id: true, name: true, slug: true, image: true },
                            },
                        },
                    },
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.order.count({ where }),
        ]);

        return NextResponse.json({
            orders,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error("List orders error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// POST /api/v1/store/orders - Create order (checkout)
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

        // Calculate totals
        let subtotal = 0;
        const orderItems = items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            const itemTotal = Number(product.price) * item.quantity;
            subtotal += itemTotal;

            return {
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
                metadata: { type: product.type },
            };
        });

        // Apply coupon if provided
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

                    // Increment usage
                    await prisma.coupon.update({
                        where: { id: coupon.id },
                        data: { usageCount: { increment: 1 } },
                    });
                }
            }
        }

        const total = subtotal - discount;

        // Create order
        const order = await prisma.order.create({
            data: {
                orderNumber: generateOrderNumber(),
                userId: session.user.id,
                status: "PENDING",
                subtotal,
                discount,
                total,
                notes,
                items: {
                    create: orderItems,
                },
            },
            include: {
                items: true,
            },
        });

        // Clear user's cart
        await prisma.cartItem.deleteMany({
            where: { userId: session.user.id },
        });

        return NextResponse.json({ order }, { status: 201 });
    } catch (error) {
        console.error("Create order error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
