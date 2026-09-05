import { prisma } from "./db";

/**
 * Where the mailer gets its transport and its return address.
 *
 * Two modules ship a screen for exactly these three values - `resend-provider`
 * and `email-templates` both write `resend_api_key`, `email_from` and
 * `email_from_name` - and nothing read the rows. An operator pasted an API key
 * into the admin panel, saw "Saved", and mail stayed off, with the key now
 * sitting in the database earning nothing. So the row is read first and the
 * environment variable is the fallback, which is the order an operator
 * expects: the image ships a default, the running site overrides it.
 *
 * Cached for a few seconds because every queued message asks. A save is not
 * required to take effect instantly; a mailer that opens a database
 * connection per message is a worse trade.
 */

export interface EmailConfig {
    apiKey: string | null;
    fromEmail: string;
    fromName: string | null;
}

const CACHE_MS = 10_000;

let cache: { value: EmailConfig; expiresAt: number } | null = null;

/** Drop the cache so the next send reloads. Called after a settings write. */
export function invalidateEmailConfig(): void {
    cache = null;
}

function firstString(...candidates: unknown[]): string | null {
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
}

const KEYS = ["resend_api_key", "email_from", "email_from_name"] as const;

export async function getEmailConfig(): Promise<EmailConfig> {
    const now = Date.now();
    if (cache && cache.expiresAt > now) return cache.value;

    const stored: Record<string, unknown> = {};
    try {
        const rows = await prisma.setting.findMany({ where: { key: { in: [...KEYS] } } });
        for (const row of rows) stored[row.key] = row.value;
    } catch {
        // A settings read must never take down the mailer; the environment
        // is a complete configuration on its own.
    }

    const value: EmailConfig = {
        apiKey: firstString(stored.resend_api_key, process.env.RESEND_API_KEY),
        fromEmail:
            firstString(stored.email_from, process.env.EMAIL_FROM) ?? "noreply@uxwvend.com",
        fromName: firstString(stored.email_from_name),
    };
    cache = { value, expiresAt: now + CACHE_MS };
    return value;
}
