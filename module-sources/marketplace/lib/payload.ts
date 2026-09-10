/**
 * What a listing carries for whoever hands it over.
 *
 * This module moves credits and takes a cut and does not know what is being
 * sold. The payload belongs to the module that claims the kind, which is why
 * the hook contract types it `unknown` and the claiming module narrows it.
 *
 * The listing endpoint used to disagree: it took `Record<string, string>`, so
 * a provider whose listing needs a number could not be written at all. The
 * first one ever built asks for a role and a number of days, and a seller
 * filling that in got a 400 - the market deciding the shape of something it
 * says it knows nothing about.
 *
 * Bounded rather than open, though. It arrives from a member, it is stored as
 * JSON and handed on, so the size, the depth and the keys are this module's
 * business even when the meaning is not. Nesting is where a bounded payload
 * stops being bounded and no provider has needed it.
 */

import { isUnsafeKey } from "@/core/sdk";

/** Wide enough for any listing form, narrow enough to stay a form. */
const MAX_KEYS = 40;
/** As long as a field somebody typed. */
const MAX_VALUE = 500;

export type ListingPayload = Record<string, string | number | boolean>;

export type PayloadResult =
    | { payload: ListingPayload | undefined }
    | { refuse: "bad_payload" };

export function readListingPayload(given: unknown): PayloadResult {
    if (given === undefined) return { payload: undefined };
    if (!given || typeof given !== "object" || Array.isArray(given)) return { refuse: "bad_payload" };

    const entries = Object.entries(given as Record<string, unknown>);
    if (entries.length > MAX_KEYS) return { refuse: "bad_payload" };

    const payload: ListingPayload = {};
    for (const [key, value] of entries) {
        // A key that reaches the prototype rather than the object, in a value
        // that is written to the database and read back by another module.
        if (isUnsafeKey(key)) return { refuse: "bad_payload" };

        if (typeof value === "string") {
            if (value.length > MAX_VALUE) return { refuse: "bad_payload" };
            payload[key] = value;
            continue;
        }
        if (typeof value === "number") {
            if (!Number.isFinite(value)) return { refuse: "bad_payload" };
            payload[key] = value;
            continue;
        }
        if (typeof value === "boolean") {
            payload[key] = value;
            continue;
        }
        return { refuse: "bad_payload" };
    }

    return { payload };
}
