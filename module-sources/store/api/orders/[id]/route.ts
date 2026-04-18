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
export async function GET(_request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        // First-pass fetch just enough to decide ownership. We defer the
        // expensive include until after the permission check so an attacker
        // who guesses another user's order id can't even elicit a latency
        // signal from the payments join.
        const ownership = await prisma.order.findFirst({
            where: { OR: [{ id }, { orderNumber: id }] },
            select: { id: true, userId: true },
        });
        if (!ownership) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        const adminCheck = await isAdmin(session.user.id);
        const isOwner = ownership.userId === session.user.id;
        if (!adminCheck && !isOwner) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Safe projection for the full payload. `Payment.metadata` is the
        // raw provider webhook body (can include PANs / PII / tokens) so we
        // never echo it to the client — only the summary fields go out.
        // The `user.email` field is restricted to admins.
        const order = await prisma.order.findUnique({
            where: { id: ownership.id },
            include: {
                user: {
                    select: adminCheck
                        ? { id: true, username: true, email: true, avatar: true }
                        : { id: true, username: true, avatar: true },
                },
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, slug: true, image: true },
                        },
                    },
                },
                payments: {
                    select: {
                        id: true,
                        amount: true,
                        currency: true,
                        status: true,
                        provider: true,
                        providerId: adminCheck,
                        createdAt: true,
                    },
                },
            },
        });

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
                { error: validation.error.issues[0].message },
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
