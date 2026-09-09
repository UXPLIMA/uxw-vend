import { NextResponse } from "next/server";
import { manualPaymentSetup } from "../../lib/setup";

/**
 * GET /api/v1/manual-payment/instructions - where to send the money.
 *
 * Public on purpose: it is what an operator wrote for anybody about to pay
 * them, and the page that shows it is reached straight from checkout. It
 * carries no order, no amount and nothing about the buyer.
 */
export async function GET() {
    const setup = await manualPaymentSetup();
    return NextResponse.json(
        { instructions: setup.instructions },
        // Cheap and the same for everyone, but an operator editing it expects
        // the next visitor to see the change.
        { headers: { "Cache-Control": "public, max-age=60" } },
    );
}
