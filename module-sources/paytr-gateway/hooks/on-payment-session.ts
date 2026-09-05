/**
 * Asks PayTR for a payment token and sends the buyer to its hosted page.
 *
 * PayTR wants the buyer's IP address, which the store does not carry in the
 * request: it is read from the headers of the checkout call this hook runs
 * inside.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { getClientIP, log } from "@/core/sdk/server";
import { headers } from "next/headers";
import {
    getPaytrConfig,
    paytrCurrency,
    paytrHash,
    toMerchantOid,
    PAYTR_PAY_URL,
    PAYTR_TOKEN_URL,
} from "../lib/paytr";

/**
 * PayTR rejects a request with no plausible client IP, and scores the one it
 * gets for fraud. Resolving it through the core helper rather than reading
 * the leftmost forwarded entry means the address sent is the one a declared
 * proxy vouched for, not one the buyer chose.
 */
async function clientIp(): Promise<string> {
    const resolved = getClientIP(await headers());
    return resolved === "unknown" ? "127.0.0.1" : resolved;
}

const onPaymentSession: HookHandlerFor<"payment.session", "filter"> = async (result, request) => {
    if (result.handled || request.provider !== "paytr") return result;

    const config = await getPaytrConfig();
    if (!config) return result;

    const currency = paytrCurrency(request.currency);
    if (!currency) return result;

    if (request.recurring) {
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "PayTR cannot take subscriptions on this site yet. Pay another way.",
        };
    }

    try {
        const merchantOid = toMerchantOid(request.reference);
        const amount = String(Math.round(request.amount * 100));
        const testMode = config.testMode ? "1" : "0";
        const noInstallment = "0";
        const maxInstallment = "0";
        // PayTR reads the basket as [[name, unit price, quantity], ...], and
        // only to display it; the amount above is what is charged.
        const basket = Buffer.from(
            JSON.stringify(request.lines.map((line) => [line.name, line.unitAmount.toFixed(2), line.quantity])),
            "utf8",
        ).toString("base64");
        const ip = await clientIp();
        const email = request.customer.email ?? "buyer@example.com";

        const token = paytrHash(
            config,
            config.merchantId + ip + merchantOid + email + amount + basket + noInstallment + maxInstallment + currency + testMode,
        );

        const body = new URLSearchParams({
            merchant_id: config.merchantId,
            user_ip: ip,
            merchant_oid: merchantOid,
            email,
            payment_amount: amount,
            paytr_token: token,
            user_basket: basket,
            debug_on: "0",
            no_installment: noInstallment,
            max_installment: maxInstallment,
            user_name: request.customer.name ?? "Musteri",
            user_address: "N/A",
            user_phone: "05000000000",
            merchant_ok_url: request.successUrl,
            merchant_fail_url: request.cancelUrl,
            timeout_limit: "30",
            currency,
            test_mode: testMode,
        });

        const response = await fetch(PAYTR_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        });
        const answer = (await response.json()) as { status?: string; token?: string; reason?: string };

        if (answer.status !== "success" || !answer.token) {
            log.error("[paytr-gateway] PayTR refused to open a payment", {
                reference: request.reference,
                error: answer.reason ?? answer.status ?? String(response.status),
            });
            return {
                handled: true,
                redirectUrl: null,
                reference: null,
                error: "The PayTR payment could not be started. Try again shortly.",
            };
        }

        return {
            handled: true,
            redirectUrl: `${PAYTR_PAY_URL}/${answer.token}`,
            reference: merchantOid,
            error: null,
        };
    } catch (error) {
        log.error("[paytr-gateway] could not start a payment", {
            reference: request.reference,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "The PayTR payment could not be started. Try again shortly.",
        };
    }
};

export default onPaymentSession;
