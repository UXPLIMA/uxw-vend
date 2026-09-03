/**
 * Asking the installed gateways to take money.
 *
 * The store does not know what a gateway is. It knows what an order costs and
 * what to hand over once it is paid for; everything between those two points
 * happens behind the `payment.providers` and `payment.session` filters, which
 * `hooks.d.ts` documents. A site with no gateway installed still works: it
 * sells free products, and takes credits if the wallet module is there.
 */
import { applyFiltersAsync } from "@/core/sdk";
import { resolveAppUrl } from "@/core/sdk/server";

/** Every gateway that can take this currency, in install order. */
export async function listPaymentProviders(currency: string): Promise<PaymentProviderSummary[]> {
    const providers = await applyFiltersAsync("payment.providers", [], {
        currency: currency.toUpperCase(),
    });
    // A gateway that answers twice, or two gateways claiming one id, would
    // render two identical buttons. First answer wins.
    const seen = new Set<string>();
    return providers.filter((provider) => {
        if (seen.has(provider.id)) return false;
        seen.add(provider.id);
        return true;
    });
}

export async function isPaymentProviderAvailable(id: string, currency: string): Promise<boolean> {
    return (await listPaymentProviders(currency)).some((provider) => provider.id === id);
}

export interface StartPaymentInput {
    provider: string;
    kind: PaymentKind;
    reference: string;
    amount: number;
    currency: string;
    description: string;
    lines: { name: string; quantity: number; unitAmount: number }[];
    customer: { userId: string | null; email: string | null; name: string | null };
    /** Set only for a plan. Gateways that cannot bill again decline the call. */
    recurring?: PaymentSessionRequest["recurring"];
    metadata?: Record<string, string>;
    successPath?: string;
    cancelPath?: string;
}

/**
 * Hands the payment to a gateway and returns where to send the buyer.
 *
 * `handled: false` means no installed module answers to that provider id,
 * which is a different failure from a gateway that tried and could not: the
 * first is a misconfigured site, the second is a bad moment at the provider,
 * and the checkout route reports them differently.
 */
export async function startPaymentSession(input: StartPaymentInput): Promise<PaymentSessionResult> {
    const baseUrl = await resolveAppUrl();
    const request: PaymentSessionRequest = {
        provider: input.provider,
        kind: input.kind,
        reference: input.reference,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        description: input.description,
        lines: input.lines,
        successUrl: `${baseUrl}${input.successPath ?? "/store/order-success"}`,
        cancelUrl: `${baseUrl}${input.cancelPath ?? "/store/cart?order=cancelled"}`,
        customer: input.customer,
        ...(input.recurring ? { recurring: input.recurring } : {}),
        metadata: input.metadata ?? {},
    };

    return applyFiltersAsync(
        "payment.session",
        { handled: false, redirectUrl: null, reference: null, error: null },
        request,
    );
}
