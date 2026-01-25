import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { z } from "zod";

const orderUpdateSchema = z.object({
    status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED"]).optional(),
    notes: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/store/orders/[id] - Get single order
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const order = await prisma.order.findFirst({
            where: {
                OR: [{ id }, { orderNumber: id }],
            },
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
                payments: true,
            },
        });

        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        // Check permission
        const adminCheck = await isAdmin(session.user.id);
        if (!adminCheck && order.userId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json({ order });
    } catch (error) {
        console.error("Get order error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH /api/v1/store/orders/[id] - Update order (admin)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const adminCheck = await isAdmin(session.user.id);
        if (!adminCheck) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const validation = orderUpdateSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }

        const existing = await prisma.order.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        const order = await prisma.order.update({
            where: { id },
            data: validation.data,
            include: {
                items: true,
                user: {
                    select: { id: true, username: true, email: true },
                },
            },
        });

        return NextResponse.json({ order });
    } catch (error) {
        console.error("Update order error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
