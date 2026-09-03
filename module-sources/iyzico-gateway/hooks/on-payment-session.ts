/**
 * Starts an iyzico Checkout Form and hands back its hosted page.
 *
 * iyzico posts the result to a callback URL rather than sending the buyer to
 * one, so where to send them afterwards travels in that URL as a path. It is a
 * path and not a URL on purpose: the callback route refuses anything that
 * could point off this site.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { log, resolveAppUrl } from "@/core/sdk/server";
import { callIyzico, getIyzicoConfig, iyzicoAmount, IyzicoFormResult } from "../lib/iyzico";

const INITIALIZE = "/payment/iyzipos/checkoutform/initialize/auth/ecom";

/** The part of one of our own URLs that is safe to carry through iyzico. */
function pathOf(url: string): string {
    try {
        const parsed = new URL(url);
        return `${parsed.pathname}${parsed.search}`;
    } catch {
        return "/store/order-success";
    }
}

/** iyzico wants the buyer split into a first and last name. */
function splitName(name: string | null): { name: string; surname: string } {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { name: "Musteri", surname: "Musteri" };
    if (parts.length === 1) return { name: parts[0], surname: parts[0] };
    return { name: parts.slice(0, -1).join(" "), surname: parts[parts.length - 1] };
}

const onPaymentSession: HookHandlerFor<"payment.session", "filter"> = async (result, request) => {
    if (result.handled || request.provider !== "iyzico") return result;

    const config = await getIyzicoConfig();
    if (!config) return result;

    // iyzico bills a plan through its own subscription product, which is a
    // separate integration. Saying so beats charging once for a plan.
    if (request.recurring) {
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "iyzico cannot take subscriptions on this site yet. Pay another way.",
        };
    }

    try {
        const baseUrl = await resolveAppUrl();
        const buyer = splitName(request.customer.name);

        // iyzico checks that the basket adds up to the price it is given, so
        // the whole amount travels as one line when the lines do not sum to it
        // (a discount lives in the total, not in a negative line).
        const linesTotal = request.lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0);
        const basketItems =
            Math.abs(linesTotal - request.amount) < 0.01
                ? request.lines.map((line, index) => ({
                      id: `${index + 1}`,
                      name: line.name.slice(0, 100),
                      category1: "Digital",
                      itemType: "VIRTUAL",
                      price: iyzicoAmount(line.unitAmount * line.quantity),
                  }))
                : [
                      {
                          id: "1",
                          name: request.description.slice(0, 100),
                          category1: "Digital",
                          itemType: "VIRTUAL",
                          price: iyzicoAmount(request.amount),
                      },
                  ];

        const callbackUrl = `${baseUrl}/api/v1/iyzico/callback?to=${encodeURIComponent(
            pathOf(request.successUrl),
        )}&cancel=${encodeURIComponent(pathOf(request.cancelUrl))}`;

        const form = await callIyzico<IyzicoFormResult>(config, INITIALIZE, {
            locale: "tr",
            conversationId: request.reference,
            basketId: request.reference,
            price: iyzicoAmount(request.amount),
            paidPrice: iyzicoAmount(request.amount),
            currency: request.currency,
            paymentGroup: "PRODUCT",
            callbackUrl,
            enabledInstallments: [1, 2, 3, 6, 9],
            buyer: {
                id: request.customer.userId ?? "guest",
                name: buyer.name,
                surname: buyer.surname,
                email: request.customer.email ?? "buyer@example.com",
                // iyzico requires both fields and validates neither against a
                // registry. A store selling game ranks does not collect a
                // national id, so it sends a placeholder rather than inventing
                // a number that looks real.
                identityNumber: "11111111111",
                gsmNumber: "+905000000000",
                registrationAddress: "N/A",
                city: "Istanbul",
                country: "Turkey",
                ip: "127.0.0.1",
            },
            billingAddress: {
                contactName: `${buyer.name} ${buyer.surname}`,
                city: "Istanbul",
                country: "Turkey",
                address: "N/A",
            },
            shippingAddress: {
                contactName: `${buyer.name} ${buyer.surname}`,
                city: "Istanbul",
                country: "Turkey",
                address: "N/A",
            },
            basketItems,
        });

        if (form.status !== "success" || !form.paymentPageUrl) {
            log.error("[iyzico-gateway] iyzico refused to open a checkout form", {
                reference: request.reference,
                error: form.errorMessage ?? form.status,
            });
            return {
                handled: true,
                redirectUrl: null,
                reference: null,
                error: "The iyzico payment could not be started. Try again shortly.",
            };
        }

        return { handled: true, redirectUrl: form.paymentPageUrl, reference: form.token ?? null, error: null };
    } catch (error) {
        log.error("[iyzico-gateway] could not start a checkout form", {
            reference: request.reference,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "The iyzico payment could not be started. Try again shortly.",
        };
    }
};

export default onPaymentSession;
