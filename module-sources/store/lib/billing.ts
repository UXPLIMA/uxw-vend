/**
 * Who an invoice is made out to.
 *
 * The shop knew who bought something - an account and an email - and nothing
 * a tax authority would accept. That is fine until something has to issue a
 * real invoice, and by then the money has been taken and the details nobody
 * asked for cannot be asked for any more.
 *
 * What is asked depends on who is buying, and the two mistakes cost different
 * amounts. Demanding a tax office from a person makes a form nobody can
 * complete, and they leave. Letting a company skip one succeeds: the checkout
 * goes through, the money moves, and the invoice is refused a day later with
 * nothing left to do about it. So a company is held to both, and a person is
 * asked for neither.
 *
 * Nothing here knows any country's rules for what a tax number looks like.
 * That belongs to whatever issues the invoice, which is the only thing that
 * knows which authority it is talking to.
 */

export type BillingKind = "individual" | "company";

export interface BillingDetails {
    kind: BillingKind;
    /** A person's full name, or a company's registered name. */
    name: string;
    /** Company only. Empty for a person. */
    taxNumber: string;
    /** Company only. Empty for a person. */
    taxOffice: string;
    address: string;
    city: string;
    /** ISO 3166-1 alpha-2, uppercase. */
    country: string;
}

/** The order they appear in on the form, so the answer reads down the page. */
const ALWAYS: (keyof BillingDetails)[] = ["name", "address", "city", "country"];
const COMPANY_ONLY: (keyof BillingDetails)[] = ["taxNumber", "taxOffice"];

const COUNTRY = /^[A-Za-z]{2}$/;

/**
 * The boxes still to fill in, in the order they are on the screen.
 *
 * All of them at once rather than the first: one at a time is a form somebody
 * submits four times.
 */
export function missingBillingFields(details: BillingDetails): (keyof BillingDetails)[] {
    const required = details.kind === "company" ? [...ALWAYS, ...COMPANY_ONLY] : ALWAYS;
    const missing = required.filter((field) => String(details[field] ?? "").trim() === "");

    // A country that is not a code is not a country to anything downstream,
    // and storing "Turkey" means an invoice refused long after the sale.
    if (!missing.includes("country") && !COUNTRY.test(details.country.trim())) {
        missing.push("country");
    }

    // Back into the order they are asked in, so the reply reads down the page
    // rather than in the order the checks happen to run.
    const order = [...ALWAYS, ...COMPANY_ONLY];
    return missing.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** What gets stored: trimmed, and without anything the buyer cannot have. */
export function normaliseBilling(details: BillingDetails): BillingDetails {
    const company = details.kind === "company";
    return {
        kind: details.kind,
        name: details.name.trim(),
        // Grouping is how it is printed on the document people copy it from,
        // and it is not part of the number.
        taxNumber: company ? details.taxNumber.replace(/[\s-]/g, "").trim() : "",
        // Cleared rather than carried: switching from company to person leaves
        // the old answers in the form, and storing them makes a person look
        // like a business to whatever reads this next.
        taxOffice: company ? details.taxOffice.trim() : "",
        address: details.address.trim(),
        city: details.city.trim(),
        country: details.country.trim().toUpperCase(),
    };
}

/** Blank answers, for a buyer who sent none at all. */
const NOTHING: BillingDetails = {
    kind: "individual",
    name: "",
    taxNumber: "",
    taxOffice: "",
    address: "",
    city: "",
    country: "",
};

/**
 * What the checkout does with the identity it was sent.
 *
 * Checked here rather than trusted from the screen: a form is a suggestion
 * and a request is what arrives.
 *
 * When nothing needs an invoice, a complete identity is still kept - the shop
 * may install something that issues them next month, and the order it already
 * has should be one it can invoice. A half-filled one is not kept, because
 * nothing checked it and half an address on an order looks like an answer.
 */
export function billingRefusal(
    required: boolean,
    sent: BillingDetails | undefined,
): { billing: BillingDetails | null } | { missing: (keyof BillingDetails)[] } {
    const details = sent ? normaliseBilling(sent) : null;

    if (!required) {
        if (!details) return { billing: null };
        return { billing: missingBillingFields(details).length === 0 ? details : null };
    }

    const missing = missingBillingFields(details ?? NOTHING);
    if (missing.length > 0) return { missing };
    return { billing: details as BillingDetails };
}
