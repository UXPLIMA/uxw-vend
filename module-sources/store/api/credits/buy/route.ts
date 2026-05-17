import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { getStripe, getStripeEnabled } from "../../../lib/stripe";
import { z } from "zod";

const buyCreditsSchema = z.object({
    amount: z.number().int().min(1, "Minimum 1 credit").max(100000, "Maximum 100,000 credits"),
});

// POST /api/v1/store/credits/buy - Purchase credits via Stripe
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!await getStripeEnabled()) {
            return NextResponse.json(
                { error: "Payments are not configured. Please contact the site administrator.", code: "payment_not_configured" },
                { status: 503 },
            );
        }

        const body = await request.json();
        const validation = buyCreditsSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
        }

        const { amount } = validation.data;

        // Read price per credit from settings (default: $0.01 per credit)
        const priceSetting = await prisma.setting.findUnique({ where: { key: "credits_price_per_unit" } });
        const pricePerCredit = Number(priceSetting?.value) || 0.01;

        const currSetting = await prisma.setting.findUnique({ where: { key: "default_currency" } });
        const currency = ((currSetting?.value as string) || "usd").toLowerCase();

        const totalAmount = amount * pricePerCredit;
        const unitAmountCents = Math.round(totalAmount * 100);

        if (unitAmountCents < 50) {
            return NextResponse.json({ error: "Minimum purchase amount is $0.50" }, { status: 400 });
        }

        const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3001";

        const checkoutSession = await (await getStripe()).checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [{
                price_data: {
                    currency,
                    product_data: { name: `${amount} Credits` },
                    unit_amount: unitAmountCents,
                },
                quantity: 1,
            }],
            metadata: {
                type: "credit_purchase",
                userId: session.user.id,
                creditAmount: String(amount),
            },
            success_url: `${baseUrl}/store?credits=purchased`,
            cancel_url: `${baseUrl}/store?credits=cancelled`,
        });

        return NextResponse.json({ redirect: checkoutSession.url }, { status: 200 });
    } catch (error) {
        console.error("Credit purchase error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
