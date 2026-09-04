import { z } from "zod";

// ==================== HELP CENTER SCHEMAS ====================

export const helpCategorySchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    slug: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional().nullable(),
    icon: z.string().max(64).optional().nullable(),
    image: z.string().max(2_000).optional().nullable(),
    order: z.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
});

/** The PATCH form: every field optional. */
export const helpCategoryUpdateSchema = helpCategorySchema.partial();

export const helpArticleSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(200),
    slug: z.string().min(1).max(200).optional(),
    content: z.string().min(10, "Content must be at least 10 characters").max(100_000, "Content is too long"),
    categoryId: z.string().min(1, "Category is required").max(64),
    isActive: z.boolean().optional(),
});

/** The PATCH form: every field optional. */
export const helpArticleUpdateSchema = helpArticleSchema.partial();

/** The one field the "was this helpful?" widget sends. */
export const helpFeedbackSchema = z.object({
    helpful: z.boolean(),
});

// Type exports
export type HelpArticleInput = z.infer<typeof helpArticleSchema>;
