import { NextRequest, NextResponse } from "next/server";
import { moduleSettings, prisma, readJsonBody, rateLimitForRoleAsync } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { z } from "zod";

const cartItemSchema = z.object({
    productId: z.string(),
    quantity: z.number().int().min(0).max(99),
});

// GET /api/v1/store/cart - Get user's cart
export async function GET() {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const cartItems = await prisma.cartItem.findMany({
            where: { userId: session.user.id },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        price: true,
                        comparePrice: true,
                        image: true,
                        stock: true,
                        isActive: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const total = cartItems.reduce((sum, item) => {
            return sum + Number(item.product.price) * item.quantity;
        }, 0);

        return NextResponse.json({
            items: cartItems,
            itemCount: cartItems.length,
            total,
        });
    } catch (error) {
        console.error("Get cart error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// POST /api/v1/store/cart - Add item to cart
export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const allowed = await rateLimitForRoleAsync(
            `cart-write:${session.user.id}`,
            { maxRequests: 60, windowMs: 60_000 },
            session.user.role
        );
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests", code: "rate_limited" }, { status: 429 });
        }

        const body = await readJsonBody(request);
        if (body instanceof NextResponse) return body;
        const validation = cartItemSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            );
        }

        const { productId, quantity } = validation.data;

        // quantity=0 means remove item from cart
        if (quantity === 0) {
            await prisma.cartItem.deleteMany({
                where: {
                    userId: session.user.id,
                    productId,
                },
            });
            return NextResponse.json({ message: "Item removed from cart" });
        }

        // Check if product exists and is active
        const product = await prisma.product.findUnique({
            where: { id: productId },
        });

        if (!product || !product.isActive) {
            return NextResponse.json(
                { error: "Product not found or unavailable" },
                { status: 404 }
            );
        }

        // Check stock
        if (product.stock !== null && product.stock < quantity) {
            return NextResponse.json(
                { error: "Insufficient stock" },
                { status: 400 }
            );
        }

        // A cart could hold every product in the catalogue: nothing capped how
        // many distinct lines it carried, only the quantity on each. The cap
        // applies to new lines only, so raising the quantity on something
        // already in the cart is never refused.
        const { maxCartItems } = await moduleSettings<{ maxCartItems: number }>("store");
        const existing = await prisma.cartItem.findUnique({
            where: { userId_productId: { userId: session.user.id, productId } },
            select: { id: true },
        });
        if (!existing) {
            const lines = await prisma.cartItem.count({ where: { userId: session.user.id } });
            if (lines >= maxCartItems) {
                return NextResponse.json(
                    { error: `A cart can hold at most ${maxCartItems} different products`, code: "cart_full" },
                    { status: 400 },
                );
            }
        }

        // Upsert cart item
        const cartItem = await prisma.cartItem.upsert({
            where: {
                userId_productId: {
                    userId: session.user.id,
                    productId,
                },
            },
            update: { quantity },
            create: {
                userId: session.user.id,
                productId,
                quantity,
            },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        image: true,
                    },
                },
            },
        });

        return NextResponse.json({ cartItem }, { status: 201 });
    } catch (error) {
        console.error("Add to cart error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE /api/v1/store/cart - Clear cart
export async function DELETE() {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const allowed = await rateLimitForRoleAsync(
            `cart-write:${session.user.id}`,
            { maxRequests: 60, windowMs: 60_000 },
            session.user.role
        );
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests", code: "rate_limited" }, { status: 429 });
        }

        await prisma.cartItem.deleteMany({
            where: { userId: session.user.id },
        });

        return NextResponse.json({ message: "Cart cleared" });
    } catch (error) {
        console.error("Clear cart error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
