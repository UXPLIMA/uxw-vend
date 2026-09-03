/**
 * Which payment buttons the checkout page should draw.
 *
 * Public: it names the gateways an operator installed and configured, which is
 * the same thing the checkout page shows anyone who reaches it. It carries no
 * keys and no amounts.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/sdk/server";
import { listPaymentProviders } from "../../lib/payments";

export async function GET(request: NextRequest) {
    const requested = request.nextUrl.searchParams.get("currency");
    // The same setting the checkout route prices an order in - asking the
    // gateways about a different currency would draw buttons for gateways that
    // cannot take the money once the order exists.
    const configured = await prisma.setting.findUnique({ where: { key: "default_currency" } });
    const currency =
        requested?.trim() || (typeof configured?.value === "string" ? configured.value : "") || "USD";

    return NextResponse.json({ providers: await listPaymentProviders(currency) });
}
