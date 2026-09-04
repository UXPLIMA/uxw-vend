import { z } from "zod";

/**
 * A custom page. `content` is rendered as HTML after `sanitizeHtml`, and was
 * previously accepted at any length the body cap allowed; `order` reached an
 * `Int` column untyped, so a string or a fraction was a 500 rather than a 400.
 */
export const customPageCreateSchema = z.object({
    title: z.string().trim().min(1, "Title and content required").max(200),
    slug: z.string().trim().min(1).max(200).optional(),
    content: z.string().min(1, "Title and content required").max(100_000),
    isActive: z.boolean().optional(),
    order: z.number().int().min(0).max(10_000).optional(),
});

export const customPageUpdateSchema = customPageCreateSchema.partial();
