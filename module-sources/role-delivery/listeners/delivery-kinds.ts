import type { HookHandlerFor } from "@/core/sdk";

/**
 * The namespace and the key, named apart rather than written as one string.
 *
 * The market screen has no namespace of its own to resolve against - it does
 * not know which module supplied the kind - so what it gets is the whole path.
 * Splitting it here says which half this module owns, and it keeps the key a
 * word the gate that hunts for strings nothing says can actually find.
 */
const NAMESPACE = "roleDelivery";
const LABEL_KEY = "kindLabel";

/**
 * What this module can hand over: a rank, for a while.
 *
 * The market asks every installed module and shows a seller the answers. It
 * knows nothing about roles and must not; the word `role` is this module's,
 * and the market only ever compares it to what a listing says.
 */
const deliveryKinds: HookHandlerFor<"marketplace.delivery.kinds", "filter"> = async (kinds) => [
    ...kinds,
    // Both, because this filter carries no locale: the key for a reader who
    // has one, the words for a site whose catalogue has not been seeded yet.
    { kind: "role", label: "A rank, for a number of days", labelKey: `${NAMESPACE}.${LABEL_KEY}` },
];

export default deliveryKinds;
