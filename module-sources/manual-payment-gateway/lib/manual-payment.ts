/**
 * A way to pay that takes no money.
 *
 * Every other gateway on this site talks to a processor: the buyer is sent
 * away, the money moves, a callback reports it. Some sales never work that
 * way. A bank transfer, an office that takes cash, an invoice settled thirty
 * days later - the shop still needs the order, and somebody confirms it by
 * hand when the money turns up.
 *
 * That makes "is it configured" a different question here. There are no
 * credentials to be missing, so the only thing that can be missing is the
 * words telling the buyer where to send the money, and a gateway offered
 * without them sends people to a page that says nothing.
 */
/** What an operator has set up. */
export interface ManualPaymentSetup {
    /** Where to send the money, in their own words. */
    instructions: string;
    /** The currencies they bank in. Empty means whatever the shop prices in. */
    currencies: string[];
}

const CODE = /^[A-Z]{3}$/;

/**
 * The currencies out of a line an operator typed.
 *
 * They separate with whatever is under their fingers, so all of it is a
 * separator. An empty box means every currency rather than none: that is what
 * somebody who does not mind leaves behind, and reading it the other way
 * switches the gateway off without telling them.
 */
export function acceptedCurrencies(typed: string | null | undefined): string[] {
    if (!typed) return [];
    const seen = new Set<string>();
    for (const part of typed.split(/[\s,;]+/)) {
        const code = part.trim().toUpperCase();
        if (CODE.test(code)) seen.add(code);
    }
    return [...seen];
}

/** Whether to offer paying by hand for a basket in this currency. */
export function offersManualPayment(setup: ManualPaymentSetup, currency: string): boolean {
    if (setup.instructions.trim() === "") return false;
    if (setup.currencies.length === 0) return true;
    return setup.currencies.includes(currency.trim().toUpperCase());
}
