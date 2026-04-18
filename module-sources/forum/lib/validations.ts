import { z } from "zod";

// ==================== FORUM SCHEMAS ====================

export const forumCategorySchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    slug: z.string().min(1).optional(),
    description: z.string().max(500).optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    order: z.number().int().optional(),
    isActive: z.boolean().optional(),
});

export const forumTopicSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(200),
    slug: z.string().min(1).optional(),
    content: z.string().min(10, "Content must be at least 10 characters").max(50000, "Content is too long"),
    categoryId: z.string().min(1, "Category is required"),
    isPinned: z.boolean().optional(),
    isLocked: z.boolean().optional(),
});

export const forumPostSchema = z.object({
    content: z.string().min(1, "Content is required").max(50000, "Content is too long"),
    topicId: z.string().min(1, "Topic is required"),
});

// Type exports
export type ForumTopicInput = z.infer<typeof forumTopicSchema>;
export type ForumPostInput = z.infer<typeof forumPostSchema>;
