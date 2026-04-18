import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { createPaypalOrder, getPaypalEnabled } from "../../../lib/paypal";

// POST /api/v1/store/checkout/paypal — Create PayPal order
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!getPaypalEnabled()) return NextResponse.json({ error: "PayPal not configured" }, { status: 400 });

    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== session.user.id || order.status !== "PENDING") {
        return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    }

    const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3001";

    const paypalOrder = await createPaypalOrder({
        amount: Number(order.total),
        currency: order.currency,
        orderId: order.id,
        returnUrl: `${baseUrl}/api/v1/store/checkout/paypal/capture?orderId=${order.id}`,
        cancelUrl: `${baseUrl}/store/cart?order=cancelled`,
    });

    await prisma.order.update({
        where: { id: orderId },
        data: { paymentMethod: "paypal", paymentId: paypalOrder.id },
    });

    return NextResponse.json({ approveUrl: paypalOrder.approveUrl });
}
