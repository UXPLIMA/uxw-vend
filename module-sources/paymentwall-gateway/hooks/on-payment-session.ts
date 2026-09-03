/**
 * Builds a signed Paymentwall widget URL.
 *
 * Nothing is created remotely: the URL is the payment, and the pingback is the
 * only report of it. The store reference travels as the external id so the
 * pingback can be matched back to an order.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { getPaymentwallConfig, paymentwallSign, PAYMENTWALL_WIDGET } from "../lib/paymentwall";

const onPaymentSession: HookHandlerFor<"payment.session", "filter"> = async (result, request) => {
    if (result.handled || request.provider !== "paymentwall") return result;

    const config = await getPaymentwallConfig();
    if (!config) return result;

    if (request.recurring) {
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "Paymentwall subscriptions are not set up on this site yet. Pay another way.",
        };
    }

    const params: Record<string, string> = {
        key: config.projectKey,
        // Paymentwall keys a buyer by this id; a guest checkout still needs
        // one, so the order stands in for the account.
        uid: request.customer.userId ?? request.reference,
        widget: "p1_1",
        ag_name: request.description.slice(0, 100),
        ag_external_id: request.reference,
        ag_type: "fixed",
        amount: request.amount.toFixed(2),
        currencyCode: request.currency,
        success_url: request.successUrl,
        sign_version: "3",
    };
    params.sig = paymentwallSign(params, config.secretKey);

    return {
        handled: true,
        redirectUrl: `${PAYMENTWALL_WIDGET}?${new URLSearchParams(params).toString()}`,
        reference: request.reference,
        error: null,
    };
};

export default onPaymentSession;
