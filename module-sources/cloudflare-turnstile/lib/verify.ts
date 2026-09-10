import { readSettingValues } from "@/core/sdk/server";

interface TurnstileConfig {
    siteKey?: string;
    secretKey?: string;
    /** Which forms the admin switched the widget on for. */
    enableOnLogin?: boolean;
    enableOnRegister?: boolean;
}

/** Load Turnstile config from settings. Returns null if not configured. */
export async function getTurnstileConfig(): Promise<TurnstileConfig | null> {
    // Through the SDK rather than off the row: `secretKey` is a declared
    // credential and arrives encrypted. Verifying with the ciphertext would
    // fail every challenge, which locks every visitor out of the login form.
    const values = await readSettingValues(["cloudflare_turnstile_config"]);
    const stored = values.cloudflare_turnstile_config;
    if (!stored || typeof stored !== "object") return null;
    return stored as TurnstileConfig;
}

/**
 * Verify a Turnstile challenge token against Cloudflare's siteverify endpoint.
 * Returns true if the token is valid, false otherwise (or if Turnstile isn't configured).
 */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
    const config = await getTurnstileConfig();
    if (!config?.secretKey) return false;

    try {
        const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `secret=${encodeURIComponent(config.secretKey)}&response=${encodeURIComponent(token)}`,
        });
        const data = (await res.json()) as { success?: boolean };
        return !!data.success;
    } catch {
        return false;
    }
}
