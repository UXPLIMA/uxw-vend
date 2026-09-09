/**
 * Starting a payment nobody is going to take.
 *
 * There is no processor to call and no hosted page to send the buyer to. What
 * starting means here is that the order is left exactly as it is - unpaid -
 * and the buyer is shown where to send the money and what to quote.
 *
 * Answering `handled: true` with no redirect would leave checkout with
 * nowhere to send them, so the redirect is to this module's own page. The
 * order number travels in the URL because it is what the buyer has to write
 * on the transfer, and it is nothing a stranger could not read off their own
 * confirmation email. The amount does not: a number in a URL is a number
 * somebody can change, and the order is where the real one lives.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { offersManualPayment } from "../lib/manual-payment";
import { manualPaymentSetup } from "../lib/setup";

const onPaymentSession: HookHandlerFor<"payment.session", "filter"> = async (result, request) => {
    if (result.handled || request.provider !== "manual-payment") return result;

    const setup = await manualPaymentSetup();
    if (!offersManualPayment(setup, request.currency)) {
        // Offered when the basket was priced, gone by the time it was paid
        // for. Refusing here is what keeps an order from parking against
        // instructions that no longer exist.
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "That way of paying is not available right now. Pay another way.",
        };
    }

    if (request.recurring) {
        // A plan renews on a clock. Nothing here renews on anything.
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "A plan cannot be paid this way. Pay another way.",
        };
    }

    // The origin of the URL the store built, rather than that URL with a
    // known suffix cut off it: the store may be told to use a different
    // success path, and a strip that quietly fails sends the buyer nowhere.
    const origin = new URL(request.successUrl).origin;
    const quote = request.metadata?.orderNumber ?? request.reference;
    return {
        handled: true,
        redirectUrl: `${origin}/payment-instructions?reference=${encodeURIComponent(quote)}`,
        reference: request.reference,
        error: null,
    };
};

export default onPaymentSession;
