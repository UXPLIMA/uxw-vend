/**
 * Where iyzico posts the result of a checkout form.
 *
 * @provider-callback: iyzico posts only an opaque token; the payment is read
 * back from iyzico with this site's own API key before anything is settled, so
 * a forged post proves nothing and grants nothing.
 *
 * The buyer's browser makes this post, so the answer is a redirect rather than
 * JSON: they end up on the store page the checkout chose.
 */
import { NextRequest, NextResponse } from "next/server";
import { applyFiltersAsync } from "@/core/sdk";
import { log, resolveAppUrl } from "@/core/sdk/server";
import { callIyzico, getIyzicoConfig, IyzicoPaymentDetail } from "../../lib/iyzico";

export const dynamic = "force-dynamic";

const DETAIL = "/payment/iyzipos/checkoutform/auth/ecom/detail";
const UNHANDLED: PaymentOutcome = { handled: false, duplicate: false, error: null };

/**
 * Only a path on this site is an acceptable destination. The parameter is ours
 * - it was written into the callback URL when the payment started - but it
 * comes back through a third party and a browser, which is exactly the shape
 * an open redirect takes.
 */
function safePath(value: string | null, fallback: string): string {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
    return value;
}

async function goTo(path: string): Promise<NextResponse> {
    return NextResponse.redirect(new URL(path, await resolveAppUrl()), 303);
}

export async function POST(request: NextRequest) {
    const success = safePath(request.nextUrl.searchParams.get("to"), "/store/order-success");
    const cancel = safePath(request.nextUrl.searchParams.get("cancel"), "/store/cart");

    const form = await request.formData();
    const token = form.get("token");
    if (typeof token !== "string" || token.length === 0) {
        return goTo(`${cancel}${cancel.includes("?") ? "&" : "?"}error=missing_token`);
    }

    const config = await getIyzicoConfig();
    if (!config) return goTo(`${cancel}${cancel.includes("?") ? "&" : "?"}error=not_configured`);

    try {
        const detail = await callIyzico<IyzicoPaymentDetail>(config, DETAIL, {
            locale: "tr",
            token,
        });

        if (detail.status !== "success" || detail.paymentStatus !== "SUCCESS" || !detail.basketId) {
            return goTo(`${cancel}${cancel.includes("?") ? "&" : "?"}error=payment_failed`);
        }

        const outcome = await applyFiltersAsync("payment.settled", UNHANDLED, {
            kind: "order",
            reference: detail.basketId,
            provider: "iyzico",
            providerRef: detail.paymentId ?? token,
            amount: Number(detail.paidPrice ?? 0),
            currency: detail.currency ?? "TRY",
        });

        if (!outcome.handled) {
            // The money moved and nothing recorded it. The buyer cannot see
            // this; an operator has to.
            log.error("[iyzico-gateway] settled a payment nothing handled", {
                basketId: detail.basketId,
                paymentId: detail.paymentId,
            });
            return goTo(`${cancel}${cancel.includes("?") ? "&" : "?"}error=settlement_failed`);
        }

        return goTo(success);
    } catch (error) {
        log.error("[iyzico-gateway] could not read a payment back", {
            error: error instanceof Error ? error.message : String(error),
        });
        return goTo(`${cancel}${cancel.includes("?") ? "&" : "?"}error=verification_failed`);
    }
}
