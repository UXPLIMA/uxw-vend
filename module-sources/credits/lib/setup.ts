/**
 * What the operator set up, read from where the settings screen writes it.
 *
 * Kept apart from `cashback.ts` and `award.ts` so those stay importable
 * without dragging a server bundle behind them.
 */
import { prisma } from "@/core/sdk/server";

export const CASHBACK_KEY = "credits_cashback_percent";

/** The percentage of a purchase paid back, or zero when there is no scheme. */
export async function cashbackPercent(): Promise<number> {
    const row = await prisma.setting.findUnique({ where: { key: CASHBACK_KEY } });
    const percent = Number(typeof row?.value === "string" ? row.value : row?.value);
    return Number.isFinite(percent) && percent > 0 ? percent : 0;
}
