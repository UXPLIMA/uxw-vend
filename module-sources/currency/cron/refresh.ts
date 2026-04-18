import { prisma } from "@/core/lib/db";

/**
 * Currency rate refresh cron job.
 *
 * Fetches latest USD-based exchange rates from a free public API and
 * upserts them into the `ExchangeRate` table. Does not touch the
 * admin-managed currency config (stored in Setting) — that preserves
 * any manual overrides. Consumers that want live rates can read from
 * ExchangeRate; admins that want fixed rates can continue using the
 * Setting-based config.
 *
 * API: exchangerate-api.com (free tier, no key required)
 */
export default async function refreshCurrencyRates(): Promise<void> {
    try {
        const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
            headers: { "accept": "application/json" },
            // Keep this short — we don't want to hang the scheduler.
            signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) {
            console.error(`[cron] currency-rate-refresh: HTTP ${res.status}`);
            return;
        }

        const data = (await res.json()) as { base?: string; rates?: Record<string, number> };
        const rates = data.rates;
        if (!rates || typeof rates !== "object") {
            console.error("[cron] currency-rate-refresh: malformed response, no rates");
            return;
        }

        let updated = 0;
        for (const [currency, rate] of Object.entries(rates)) {
            if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) continue;
            try {
                await prisma.exchangeRate.upsert({
                    where: { currency },
                    create: { currency, rate: rate.toString() },
                    update: { rate: rate.toString() },
                });
                updated++;
            } catch (err) {
                console.error(`[cron] currency-rate-refresh: failed to upsert ${currency}:`, err);
            }
        }

        console.log(`[cron] currency-rate-refresh: updated ${updated} currencies`);
    } catch (err) {
        console.error("[cron] currency-rate-refresh failed:", err);
    }
}
