/** Creates a Coinbase Commerce charge and sends the buyer to its hosted page. */
import type { HookHandlerFor } from "@/core/sdk";
import { log } from "@/core/sdk/server";
import { COINBASE_API, COINBASE_API_VERSION, CoinbaseCharge, getCoinbaseConfig } from "../lib/coinbase";

const onPaymentSession: HookHandlerFor<"payment.session", "filter"> = async (result, request) => {
    if (result.handled || request.provider !== "coinbase-commerce") return result;

    const config = await getCoinbaseConfig();
    if (!config) return result;

    // A coin payment is a one-off transfer. There is nothing to bill again.
    if (request.recurring) {
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "Crypto cannot be used for a subscription. Pay by card instead.",
        };
    }

    try {
        const response = await fetch(`${COINBASE_API}/charges`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CC-Api-Key": config.apiKey,
                "X-CC-Version": COINBASE_API_VERSION,
            },
            body: JSON.stringify({
                name: request.description.slice(0, 100),
                description: request.description.slice(0, 200),
                pricing_type: "fixed_price",
                local_price: { amount: request.amount.toFixed(2), currency: request.currency },
                // Coinbase hands the metadata back on every webhook, which is
                // how the order is recognised when the coins finally confirm.
                metadata: { ...request.metadata, reference: request.reference, kind: request.kind },
                redirect_url: request.successUrl,
                cancel_url: request.cancelUrl,
            }),
        });

        const charge = (await response.json()) as CoinbaseCharge;
        if (!response.ok || !charge.data?.hosted_url) {
            log.error("[coinbase-commerce-gateway] Coinbase refused to create a charge", {
                reference: request.reference,
                error: charge.error?.message ?? String(response.status),
            });
            return {
                handled: true,
                redirectUrl: null,
                reference: null,
                error: "The crypto payment could not be started. Try again shortly.",
            };
        }

        return {
            handled: true,
            redirectUrl: charge.data.hosted_url,
            reference: charge.data.code ?? charge.data.id ?? null,
            error: null,
        };
    } catch (error) {
        log.error("[coinbase-commerce-gateway] could not create a charge", {
            reference: request.reference,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "The crypto payment could not be started. Try again shortly.",
        };
    }
};

export default onPaymentSession;
