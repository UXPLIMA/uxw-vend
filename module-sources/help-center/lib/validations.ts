import { z } from "zod";

// ==================== HELP CENTER SCHEMAS ====================

export const helpCategorySchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    slug: z.string().min(1).optional(),
    description: z.string().max(500).optional(),
    icon: z.string().optional(),
    image: z.string().optional(),
    order: z.number().int().optional(),
    isActive: z.boolean().optional(),
});

export const helpArticleSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(200),
    slug: z.string().min(1).optional(),
    content: z.string().min(10, "Content must be at least 10 characters"),
    categoryId: z.string().min(1, "Category is required"),
    isActive: z.boolean().optional(),
});

// Type exports
export type HelpArticleInput = z.infer<typeof helpArticleSchema>;
