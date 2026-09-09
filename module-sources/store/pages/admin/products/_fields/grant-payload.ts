/**
 * What buying a product gives, as the form holds it and as the API takes it.
 *
 * Kept apart from the card that draws it because this half is pure: an input
 * gives back strings, the API takes numbers and nulls, and the gap between
 * them is where the quiet defects live. `Number("")` is 0, and a duration of
 * zero days is a product that lapses the instant somebody buys it.
 */

export interface GrantValue {
    durationDays: string;
    grantsRoleId: string;
}

export const EMPTY_GRANT: GrantValue = {
    durationDays: "",
    grantsRoleId: "",
};

/** What the form sends. Empty means "no rule", never zero and never "". */
export function grantPayload(value: GrantValue) {
    const days = Number(value.durationDays);
    return {
        durationDays: value.durationDays && Number.isFinite(days) && days > 0 ? Math.floor(days) : null,
        grantsRoleId: value.grantsRoleId || null,
    };
}
