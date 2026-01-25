import { z } from "zod";

// ==================== AUTH SCHEMAS ====================

export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
    email: z.string().email("Invalid email address"),
    username: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(20, "Username must be at most 20 characters")
        .regex(
            /^[a-zA-Z0-9_]+$/,
            "Username can only contain letters, numbers, and underscores"
        ),
    password: z
        .string()
        .min(6, "Password must be at least 6 characters")
        .max(100, "Password must be at most 100 characters"),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

// ==================== USER SCHEMAS ====================

export const updateUserSchema = z.object({
    username: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(20, "Username must be at most 20 characters")
        .regex(
            /^[a-zA-Z0-9_]+$/,
            "Username can only contain letters, numbers, and underscores"
        )
        .optional(),
    avatar: z.string().url("Invalid URL").optional().nullable(),
});

export const updatePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

// ==================== STORE SCHEMAS ====================

export const productSchema = z.object({
    name: z.string().min(1, "Name is required").max(200),
    slug: z.string().min(1).optional(),
    description: z.string().optional(),
    shortDesc: z.string().max(500).optional(),
    price: z.number().min(0, "Price must be positive"),
    comparePrice: z.number().min(0).optional().nullable(),
    image: z.string().url().optional().nullable(),
    images: z.array(z.string().url()).optional(),
    stock: z.number().int().min(0).optional().nullable(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    type: z.enum(["DIGITAL", "PHYSICAL", "GAME_ITEM", "SUBSCRIPTION"]).optional(),
    categoryId: z.string().optional().nullable(),
    deliveryData: z.any().optional(),
});

export const categorySchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    slug: z.string().min(1).optional(),
    description: z.string().max(500).optional(),
    image: z.string().url().optional().nullable(),
    parentId: z.string().optional().nullable(),
    order: z.number().int().optional(),
    isActive: z.boolean().optional(),
});

export const couponSchema = z.object({
    code: z.string().min(3).max(50).toUpperCase(),
    description: z.string().optional(),
    type: z.enum(["PERCENTAGE", "FIXED"]),
    value: z.number().min(0),
    minPurchase: z.number().min(0).optional().nullable(),
    maxDiscount: z.number().min(0).optional().nullable(),
    usageLimit: z.number().int().min(1).optional().nullable(),
    startsAt: z.string().datetime().optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
    isActive: z.boolean().optional(),
});

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
    content: z.string().min(10, "Content must be at least 10 characters"),
    categoryId: z.string().min(1, "Category is required"),
    isPinned: z.boolean().optional(),
    isLocked: z.boolean().optional(),
});

export const forumPostSchema = z.object({
    content: z.string().min(1, "Content is required"),
    topicId: z.string().min(1, "Topic is required"),
});

// ==================== BLOG SCHEMAS ====================

export const blogCategorySchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    slug: z.string().min(1).optional(),
    description: z.string().max(500).optional(),
});

export const blogArticleSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(200),
    slug: z.string().min(1).optional(),
    excerpt: z.string().max(500).optional(),
    content: z.string().min(10, "Content must be at least 10 characters"),
    coverImage: z.string().url().optional().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"]).optional(),
    publishedAt: z.string().datetime().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
});

export const blogCommentSchema = z.object({
    content: z.string().min(1, "Comment is required").max(2000),
    articleId: z.string().min(1),
});

// ==================== TICKET SCHEMAS ====================

export const ticketDepartmentSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional(),
    color: z.string().optional(),
    order: z.number().int().optional(),
    isActive: z.boolean().optional(),
});

export const ticketSchema = z.object({
    subject: z.string().min(3, "Subject must be at least 3 characters").max(200),
    departmentId: z.string().min(1, "Department is required"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    message: z.string().min(10, "Message must be at least 10 characters"),
});

export const ticketMessageSchema = z.object({
    content: z.string().min(1, "Message is required"),
    ticketId: z.string().min(1),
    attachments: z.array(z.string().url()).optional(),
});

export const ticketUpdateSchema = z.object({
    status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_REPLY", "RESOLVED", "CLOSED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    assignedToId: z.string().optional().nullable(),
});

// ==================== HELP CENTER SCHEMAS ====================

export const helpCategorySchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    slug: z.string().min(1).optional(),
    description: z.string().max(500).optional(),
    icon: z.string().optional(),
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

// ==================== ROLE & PERMISSION SCHEMAS ====================

export const roleSchema = z.object({
    name: z.string().min(1).max(50).regex(/^[a-z_]+$/, "Name must be lowercase with underscores"),
    displayName: z.string().min(1).max(100),
    color: z.string().optional(),
    priority: z.number().int().optional(),
    permissions: z.array(z.string()).optional(),
});

// ==================== SETTINGS SCHEMAS ====================

export const settingSchema = z.object({
    key: z.string().min(1),
    value: z.any(),
    module: z.string().optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type CouponInput = z.infer<typeof couponSchema>;
export type ForumTopicInput = z.infer<typeof forumTopicSchema>;
export type ForumPostInput = z.infer<typeof forumPostSchema>;
export type BlogArticleInput = z.infer<typeof blogArticleSchema>;
export type TicketInput = z.infer<typeof ticketSchema>;
export type TicketMessageInput = z.infer<typeof ticketMessageSchema>;
export type HelpArticleInput = z.infer<typeof helpArticleSchema>;
export type RoleInput = z.infer<typeof roleSchema>;
