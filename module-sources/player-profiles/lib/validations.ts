import { z } from "zod";

/**
 * A linked third-party account.
 *
 * All four fields used to be written straight to the row. `provider` and
 * `providerId` together form a unique key that the route looks up before it
 * writes, so an object in either place was a filter operator against that
 * lookup rather than a value; `username` and `avatar` had no ceiling at all,
 * which made this the cheapest way for any signed-in account to store most of
 * a megabyte of arbitrary text per provider it named.
 */
export const linkAccountSchema = z.object({
    provider: z.string().trim().min(1, "Provider and ID required").max(32),
    providerId: z.string().trim().min(1, "Provider and ID required").max(128),
    username: z.string().max(128).optional().nullable(),
    avatar: z.string().max(2_000).optional().nullable(),
});

export const unlinkAccountSchema = z.object({
    provider: z.string().trim().min(1, "Provider required").max(32),
});
