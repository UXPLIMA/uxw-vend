import { z } from "zod";

/**
 * A vote site, and a claim against one.
 *
 * `voteSiteId` reached a Prisma `where` clause untyped, where an object is a
 * filter operator rather than an id; `reward` and `order` reach `Int` columns,
 * so a string or a fraction was a 500 rather than a 400.
 */
export const voteClaimSchema = z.object({
    voteSiteId: z.string().trim().min(1, "Vote site ID required").max(64),
});

export const voteSiteCreateSchema = z.object({
    name: z.string().trim().min(1, "Name and URL required").max(100),
    url: z.string().trim().min(1, "Name and URL required").max(2_000),
    reward: z.number().int().min(0).max(100_000).optional(),
    icon: z.string().max(2_000).optional().nullable(),
    order: z.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
});

export const voteSiteUpdateSchema = voteSiteCreateSchema.partial();
