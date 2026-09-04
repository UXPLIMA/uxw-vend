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


// ==================== THE REST OF THE STORE'S WRITES ====================
//
// These endpoints had no schema at all. Between them they wrote to five
// tables straight from an untyped body: percentages and quantities that reach
// `Int` columns, a coupon code and a gift code that reach `.toUpperCase()`
// (a throw on anything but a string), a player name that reaches an RCON
// command, and a username that reaches a Prisma `where` clause, where an
// object is a filter operator rather than a name.

/** A percentage, as the store's Int columns store one. */
const percent = z.number().int().min(0).max(100);

export const bulkDiscountUpdateSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    minQuantity: z.number().int().min(1).max(1_000_000).optional(),
    discountPercent: percent.optional(),
    productId: z.string().max(64).optional().nullable(),
    categoryId: z.string().max(64).optional().nullable(),
    isActive: z.boolean().optional(),
});

/**
 * Redeeming a chest item, or handing it to somebody else. `giftTo` is matched
 * against both `username` and `id`, and `playerName` is interpolated into the
 * commands the delivery runs, so both are bounded to what those can mean.
 */
export const chestRedeemSchema = z.object({
    giftTo: z.string().trim().max(64).optional().nullable(),
    playerName: z.string().trim().max(64).optional().nullable(),
});

/** The community goal banner: a target, a title, and when it ends. */
export const communityGoalSchema = z.object({
    target: z.number().min(0).max(1_000_000_000).optional(),
    title: z.string().max(200).optional(),
    endDate: z.string().max(64).optional().nullable(),
});

/** Checking a coupon at the basket. */
export const couponValidateSchema = z.object({
    code: z.string().trim().min(1, "Code required").max(50),
    subtotal: z.number().min(0).max(1_000_000_000).optional(),
});

export const creatorCodeCreateSchema = z.object({
    code: z.string().trim().min(1, "Code and creator required").max(50),
    creatorId: z.string().trim().min(1, "Code and creator required").max(64),
    discountPercent: percent.optional(),
    commissionPercent: percent.optional(),
});

export const creatorCodeUpdateSchema = z.object({
    code: z.string().trim().min(1).max(50).optional(),
    creatorId: z.string().max(64).optional().nullable(),
    discountPercent: percent.optional(),
    commissionPercent: percent.optional(),
    isActive: z.boolean().optional(),
});

export const giftCodeCreateSchema = z.object({
    value: z.number().positive("Value must be positive").max(1_000_000),
    description: z.string().max(500).optional().nullable(),
    count: z.number().int().min(1).max(100).optional(),
    expiresAt: z.iso.datetime({ offset: true }).optional().nullable(),
});

export const giftCodeRedeemSchema = z.object({
    code: z.string().trim().min(1, "Code is required").max(64),
});

export const productCommandSchema = z.object({
    productId: z.string().trim().min(1, "productId and command required").max(64),
    command: z.string().trim().min(1, "productId and command required").max(1_000),
    serverId: z.string().max(64).optional().nullable(),
    order: z.number().int().min(0).max(10_000).optional(),
});

export const productVariableSchema = z.object({
    productId: z.string().trim().min(1, "productId, name, label required").max(64),
    name: z.string().trim().min(1, "productId, name, label required").max(64),
    label: z.string().trim().min(1, "productId, name, label required").max(200),
    type: z.string().max(32).optional(),
    required: z.boolean().optional(),
    placeholder: z.string().max(200).optional().nullable(),
    options: z.string().max(2_000).optional().nullable(),
});

// Type exports
export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type CouponInput = z.infer<typeof couponSchema>;
