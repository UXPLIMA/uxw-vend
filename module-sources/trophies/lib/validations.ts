import { z } from "zod";

/**
 * Editing one trophy. The POST that creates trophies already validates; this
 * is the PATCH that did not, so `description`, `icon`, `color` and `awardOn`
 * reached the row as whatever arrived and at whatever length.
 */
export const trophyUpdateSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    icon: z.string().max(64).optional().nullable(),
    color: z.string().max(64).optional().nullable(),
    points: z.number().int().min(0).max(1_000_000).optional(),
    awardOn: z.string().max(128).optional().nullable(),
});
