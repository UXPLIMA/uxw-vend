/**
 * The market contract.
 *
 * This module moves credits and takes a cut. It has no idea what a member is
 * selling, and it must not: a game item, a rank, a key, something a module
 * invented last week. Whatever is installed answers both of these.
 *
 * The kinds are asked for twice - once so a seller can pick one, and again at
 * the moment of sale, because a module gets uninstalled and the listings it
 * made deliverable outlive it.
 */
declare global {
    interface UxwVendFilterPayloads {
        /** Everything anything installed here can hand over. */
        "marketplace.delivery.kinds": MarketDeliveryKind[];
        /** Whether somebody handed it over. */
        "marketplace.deliver": MarketDeliveryOutcome;
    }

    interface UxwVendFilterContexts {
        "marketplace.delivery.kinds": Record<string, never>;
        "marketplace.deliver": MarketDelivery;
    }

    interface MarketDeliveryKind {
        /** Matches the `kind` on a listing. */
        kind: string;
        /** What a seller reads when picking it. */
        label: string;
        /**
         * The same words as a translation key, when the module that supplies
         * the kind has one. This filter carries no locale - it is asked once
         * for the whole site - so the module cannot translate its own label
         * and hands over both. The same bargain the navbar and the footer
         * make with a module's links.
         */
        labelKey?: string;
    }

    interface MarketDelivery {
        kind: string;
        /** What the seller filled in for this listing. */
        payload: unknown;
        buyerId: string;
        sellerId: string;
        listingId: string;
    }

    interface MarketDeliveryOutcome {
        /** False when nothing claimed the kind, which is a sale to unpick. */
        handled: boolean;
        /** Why it could not be handed over, or null when it was. */
        error: string | null;
    }
}

export {};
