import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import { capturePaypalOrder } from "../../../../lib/paypal";
import { sendOrderConfirmationEmail } from "../../../../lib/email";
import { sendDiscordWebhook } from "@/core/lib/discord";
import { deliverProduct } from "../../../../lib/rcon";

// GET /api/v1/store/checkout/paypal/capture — PayPal return URL after approval
export async function GET(request: NextRequest) {
    const orderId = request.nextUrl.searchParams.get("orderId");
    const token = request.nextUrl.searchParams.get("token"); // PayPal order ID

    if (!orderId || !token) {
        return NextResponse.redirect(new URL("/store/cart?error=missing_params", request.url));
    }

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: { select: { email: true, username: true } }, items: true },
    });

    if (!order || order.status !== "PENDING") {
        return NextResponse.redirect(new URL("/store/cart?error=invalid_order", request.url));
    }
    // Order.userId is nullable (SetNull on user deletion). At checkout-capture
    // the row should always still have a buyer, but guard against the edge
    // case where the user account vanished between authorization and capture.
    if (!order.userId || !order.user) {
        return NextResponse.redirect(new URL("/store/cart?error=invalid_order", request.url));
    }
    const buyerId = order.userId;
    const buyer = order.user;

    try {
        const result = await capturePaypalOrder(token);
        if (result.status !== "COMPLETED") {
            return NextResponse.redirect(new URL("/store/cart?error=payment_failed", request.url));
        }

        // Update order
        await prisma.order.update({
            where: { id: orderId },
            data: { status: "COMPLETED", paymentId: token },
        });

        // Grant ownership
        for (const item of order.items) {
            if (!item.productId) continue;
            await prisma.chestItem.create({
                data: { userId: buyerId, productId: item.productId, productName: item.name, quantity: item.quantity, orderId: order.id },
            });
            await prisma.ownedProduct.upsert({
                where: { userId_productId: { userId: buyerId, productId: item.productId } },
                update: {},
                create: { userId: buyerId, productId: item.productId, orderId: order.id },
            });
        }

        // Payment record
        await prisma.payment.create({
            data: {
                orderId, provider: "paypal", providerId: token,
                amount: result.amount, currency: order.currency.toLowerCase(), status: "COMPLETED",
            },
        });

        // Email + Discord + RCON
        sendOrderConfirmationEmail(buyer.email, order.orderNumber, Number(order.total)).catch(console.error);

        const playerName = (order.metadata as Record<string, unknown>)?.playerName as string || buyer.username || "Player";
        for (const item of order.items) {
            if (!item.productId) continue;
            const commands = await prisma.productCommand.findMany({ where: { productId: item.productId }, orderBy: { order: "asc" } });
            if (commands.length > 0) {
                const itemVars = (item.metadata as Record<string, unknown>)?.variables as Record<string, string> | undefined;
                deliverProduct({ playerName, productName: item.name, commands: commands.map(c => ({ command: c.command, serverId: c.serverId })), quantity: item.quantity, variables: itemVars }).catch(console.error);
            }
        }

        sendDiscordWebhook("order_completed", {
            embeds: [{ title: "Order Completed (PayPal)", color: 0x0070ba, fields: [
                { name: "Order", value: order.orderNumber, inline: true },
                { name: "Total", value: `${Number(order.total)} ${order.currency}`, inline: true },
            ], timestamp: new Date().toISOString() }],
        }).catch(console.error);

        const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3001";
        return NextResponse.redirect(new URL("/store/order-success", baseUrl));
    } catch (err) {
        console.error("PayPal capture error:", err);
        return NextResponse.redirect(new URL("/store/cart?error=capture_failed", request.url));
    }
}
