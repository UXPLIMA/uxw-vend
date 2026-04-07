import { z } from "zod";

const envSchema = z.object({
    // Required
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),

    // Optional - Auth
    AUTH_URL: z.string().url().optional(),
    NEXTAUTH_URL: z.string().url().optional(),

    // Optional - Infrastructure
    NODE_ENV: z.string().optional(),
    REDIS_URL: z.string().optional(),

    // Optional - App
    NEXT_PUBLIC_APP_NAME: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_IMAGE_DOMAINS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let validated = false;

export function validateEnv() {
    if (validated) return;

    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const errors = result.error.issues.map(
            (i) => `  ${i.path.join(".")}: ${i.message}`
        );
        console.warn(
            `[warn] Environment validation warnings:\n${errors.join("\n")}\n`
        );
    }

    validated = true;
}

// Validate on import (server-side only)
if (typeof window === "undefined") {
    validateEnv();
}
