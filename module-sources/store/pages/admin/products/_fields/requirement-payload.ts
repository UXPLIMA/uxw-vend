/**
 * What a product needs bought first, as the form holds it and the API takes it.
 *
 * Pure, and apart from the card that draws it, for the same reason the grant
 * fields are: the mapping is where the quiet defect lives and it deserves a
 * test that does not need a browser.
 */

export interface RequirementValue {
    requiresProductIds: string[];
    requiresAny: boolean;
}

export const EMPTY_REQUIREMENT: RequirementValue = {
    requiresProductIds: [],
    requiresAny: false,
};

/** What the form sends. An empty list asks for nothing. */
export function requirementPayload(value: RequirementValue) {
    return {
        requiresProductIds: value.requiresProductIds,
        requiresAny: value.requiresAny,
    };
}

/**
 * The products the picker may offer.
 *
 * Everything except the one being edited. A product that requires itself is
 * unbuyable by anybody, for ever, and nothing on the page would say why. The
 * API drops it as well - that is what holds against a direct call - but a
 * form should not offer the trap at all.
 */
export function choosableProducts<T extends { id: string }>(all: T[], selfId: string | undefined): T[] {
    return selfId ? all.filter((product) => product.id !== selfId) : all;
}
