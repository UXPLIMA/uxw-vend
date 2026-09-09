/**
 * What the operator has set up.
 *
 * Kept apart from `manual-payment.ts` on purpose. That file holds the
 * decisions and nothing else, so it stays importable anywhere - including
 * from a test that has no business starting a server bundle.
 *
 * The rows are read from `Setting`, which is where the settings screen writes
 * them, the same way every other gateway on this site reads its credentials.
 * `moduleSettings()` reads a different table and would have found nothing.
 */
import { prisma } from "@/core/sdk/server";
import { acceptedCurrencies, type ManualPaymentSetup } from "./manual-payment";

export const INSTRUCTIONS_KEY = "manual_payment_instructions";
export const CURRENCIES_KEY = "manual_payment_currencies";

export async function manualPaymentSetup(): Promise<ManualPaymentSetup> {
    const rows = await prisma.setting.findMany({
        where: { key: { in: [INSTRUCTIONS_KEY, CURRENCIES_KEY] } },
    });
    const map = new Map(rows.map((row) => [row.key, typeof row.value === "string" ? row.value : ""]));
    return {
        instructions: map.get(INSTRUCTIONS_KEY) ?? "",
        currencies: acceptedCurrencies(map.get(CURRENCIES_KEY)),
    };
}
