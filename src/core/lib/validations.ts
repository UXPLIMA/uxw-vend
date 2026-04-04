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
export type RoleInput = z.infer<typeof roleSchema>;
