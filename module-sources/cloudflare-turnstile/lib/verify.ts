import { prisma } from "@/core/lib/db";

interface TurnstileConfig {
    siteKey?: string;
    secretKey?: string;
}

/** Load Turnstile config from settings. Returns null if not configured. */
export async function getTurnstileConfig(): Promise<TurnstileConfig | null> {
    const setting = await prisma.setting.findUnique({
        where: { key: "cloudflare_turnstile_config" },
    });
    if (!setting?.value || typeof setting.value !== "object") return null;
    return setting.value as TurnstileConfig;
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
