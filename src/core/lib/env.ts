import { z } from "zod";

const envSchema = z.object({
    // Required
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),

    // Optional - Auth
    AUTH_URL: z.string().url().optional(),
    AUTH_DISCORD_ID: z.string().optional(),
    AUTH_DISCORD_SECRET: z.string().optional(),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),

    // Optional - Payments
    STRIPE_PUBLIC_KEY: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // Optional - Email
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),

    // Optional - Game Server
    RCON_HOST: z.string().optional(),
    RCON_PORT: z.string().optional(),
    RCON_PASSWORD: z.string().optional(),
    MC_SERVER_HOST: z.string().optional(),
    MC_SERVER_PORT: z.string().optional(),

    // Optional - Security
    TURNSTILE_SECRET_KEY: z.string().optional(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),

    // Optional - Analytics
    NEXT_PUBLIC_GA_ID: z.string().optional(),

    // Optional - Discord
    DISCORD_WEBHOOK_URL: z.string().url().optional(),

    // Optional - App
    NEXT_PUBLIC_APP_NAME: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),

    // Optional - Punishments
    PUNISHMENTS_API_KEY: z.string().optional(),
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
            `⚠️  Environment validation warnings:\n${errors.join("\n")}\n`
        );
    }

    validated = true;
}

// Validate on import (server-side only)
if (typeof window === "undefined") {
    validateEnv();
}
