/**
 * Buying credits.
 *
 * Same contract as an order: the store prices the top-up and asks whichever
 * gateway the buyer picked to take the money. What comes back is a redirect,
 * and the credits are granted only when that gateway reports the payment
 * settled - never here.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma, rateLimitForRole } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { z } from "zod";
import { startPaymentSession, isPaymentProviderAvailable, listPaymentProviders } from "../../../lib/payments";

const buyCreditsSchema = z.object({
    amount: z.number().int().min(1, "Minimum 1 credit").max(100000, "Maximum 100,000 credits"),
    provider: z.string().min(1).max(32).optional(),
});

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Every call opens a session at the payment gateway, which costs a
        // request there whether or not anyone pays. A budget, not a
        // brute-force ceiling, so role multipliers apply.
        const rl = await rateLimitForRole(
            `credits-buy:${session.user.id}`,
            { maxRequests: 15, windowMs: 15 * 60 * 1000 },
            session.user.role,
        );
        if (!rl.success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const body = await request.json();
        const validation = buyCreditsSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
        }

        const { amount } = validation.data;

        const priceSetting = await prisma.setting.findUnique({ where: { key: "credits_price_per_unit" } });
        const pricePerCredit = Number(priceSetting?.value) || 0.01;

        const currSetting = await prisma.setting.findUnique({ where: { key: "default_currency" } });
        const currency = ((currSetting?.value as string) || "USD").toUpperCase();

        const totalAmount = amount * pricePerCredit;
        if (Math.round(totalAmount * 100) < 50) {
            return NextResponse.json({ error: "Minimum purchase amount is $0.50" }, { status: 400 });
        }

        // Without a named provider, take the first gateway that can hold this
        // currency. A site usually has one, and asking a buyer to choose
        // between none and one is not a choice.
        const provider =
            validation.data.provider ?? (await listPaymentProviders(currency))[0]?.id ?? "";

        if (!provider || !(await isPaymentProviderAvailable(provider, currency))) {
            return NextResponse.json(
                {
                    error: "Payments are not configured. Please contact the site administrator.",
                    code: "payment_not_configured",
                },
                { status: 503 },
            );
        }

        const buyer = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { email: true, username: true },
        });

        const payment = await startPaymentSession({
            provider,
            kind: "credits",
            // Credits have no order row, so the reference is the buyer: it is
            // what the settlement needs to find them again.
            reference: session.user.id,
            amount: totalAmount,
            currency,
            description: `${amount} credits`,
            lines: [{ name: `${amount} Credits`, quantity: 1, unitAmount: totalAmount }],
            customer: { userId: session.user.id, email: buyer?.email ?? null, name: buyer?.username ?? null },
            metadata: {
                type: "credit_purchase",
                userId: session.user.id,
                creditAmount: String(amount),
            },
            successPath: "/store?credits=purchased",
            cancelPath: "/store?credits=cancelled",
        });

        if (!payment.handled || !payment.redirectUrl) {
            return NextResponse.json(
                { error: payment.error ?? "The payment could not be started. Try again shortly." },
                { status: payment.handled ? 502 : 503 },
            );
        }

        return NextResponse.json({ redirect: payment.redirectUrl }, { status: 200 });
    } catch (error) {
        console.error("Credit purchase error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
