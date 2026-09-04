import { z } from "zod";

/**
 * A prize on the wheel.
 *
 * `probability` decides how often it is drawn and `value` decides what it
 * pays out, and both reached `Int` columns untyped: a fractional probability
 * or a string value was a 500. The PATCH coerced with `Number(...) || fallback`
 * instead, which silently turned a typo into the default rather than an error;
 * the coercion is kept so a client sending "10" still works, but the result
 * now has to be a whole number in range.
 */
export const wheelPrizeCreateSchema = z.object({
    name: z.string().trim().min(1, "Name and type required").max(100),
    type: z.string().trim().min(1, "Name and type required").max(32),
    value: z.coerce.number().int().min(0).max(1_000_000).optional(),
    color: z.string().max(32).optional(),
    probability: z.coerce.number().int().min(0).max(1_000_000).optional(),
    order: z.coerce.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
});

export const wheelPrizeUpdateSchema = wheelPrizeCreateSchema.partial();
