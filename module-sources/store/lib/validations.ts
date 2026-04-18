import { z } from "zod";

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
    subscriptionInterval: z.enum(["month", "year"]).optional().nullable(),
    subscriptionIntervalCount: z.number().int().min(1).max(12).optional().nullable(),
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

// Type exports
export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type CouponInput = z.infer<typeof couponSchema>;
