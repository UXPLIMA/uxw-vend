import { z } from "zod";

/**
 * A homepage slide. `image` is required by the database but was not required
 * by the route, so a POST without one was a 500; everything else reached the
 * row with no ceiling.
 */
export const slideCreateSchema = z.object({
    title: z.string().max(200).optional().nullable(),
    subtitle: z.string().max(500).optional().nullable(),
    image: z.string().trim().min(1, "Image is required").max(2_000),
    link: z.string().max(2_000).optional().nullable(),
    order: z.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
});

export const slideUpdateSchema = slideCreateSchema.partial();
