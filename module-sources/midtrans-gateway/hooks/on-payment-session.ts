/** Creates a Midtrans Snap transaction and sends the buyer to its page. */
import type { HookHandlerFor } from "@/core/sdk";
import { log } from "@/core/sdk/server";
import { getMidtransConfig, midtransAuth, toOrderId } from "../lib/midtrans";

interface SnapResponse {
    token?: string;
    redirect_url?: string;
    error_messages?: string[];
}

const onPaymentSession: HookHandlerFor<"payment.session", "filter"> = async (result, request) => {
    if (result.handled || request.provider !== "midtrans") return result;

    const config = await getMidtransConfig();
    if (!config) return result;
    if (request.currency.toUpperCase() !== "IDR") return result;

    if (request.recurring) {
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "Midtrans subscriptions are not set up on this site yet. Pay another way.",
        };
    }

    try {
        const orderId = toOrderId(request.reference);
        // Rupiah has no cents: Midtrans rejects a gross amount with decimals,
        // and expects the item prices to add up to it exactly.
        const gross = Math.round(request.amount);
        const items = request.lines.map((line) => ({
            id: line.name.slice(0, 40),
            name: line.name.slice(0, 50),
            price: Math.round(line.unitAmount),
            quantity: line.quantity,
        }));
        const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        if (itemsTotal !== gross) {
            // Rounding, or a discount that lives in the total: send the order
            // as one line rather than a basket Midtrans will refuse.
            items.length = 0;
            items.push({ id: "order", name: request.description.slice(0, 50), price: gross, quantity: 1 });
        }

        const response = await fetch(config.snapUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: midtransAuth(config),
            },
            body: JSON.stringify({
                transaction_details: { order_id: orderId, gross_amount: gross },
                item_details: items,
                customer_details: {
                    first_name: request.customer.name ?? "Customer",
                    email: request.customer.email ?? undefined,
                },
                callbacks: { finish: request.successUrl },
            }),
        });

        const snap = (await response.json()) as SnapResponse;
        if (!response.ok || !snap.redirect_url) {
            log.error("[midtrans-gateway] Midtrans refused to create a transaction", {
                reference: request.reference,
                error: snap.error_messages?.join("; ") ?? String(response.status),
            });
            return {
                handled: true,
                redirectUrl: null,
                reference: null,
                error: "The Midtrans payment could not be started. Try again shortly.",
            };
        }

        return { handled: true, redirectUrl: snap.redirect_url, reference: orderId, error: null };
    } catch (error) {
        log.error("[midtrans-gateway] could not create a transaction", {
            reference: request.reference,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "The Midtrans payment could not be started. Try again shortly.",
        };
    }
};

export default onPaymentSession;
