/**
 * What the operator set up, read from where the settings screen writes it.
 *
 * Apart from `sale.ts` and `delivery.ts` so those stay importable without
 * dragging a server bundle behind them.
 */
import { prisma } from "@/core/sdk/server";

export const COMMISSION_KEY = "marketplace_commission_percent";

/** The site's cut, as a percentage. Zero means it takes none. */
export async function commissionPercent(): Promise<number> {
    const row = await prisma.setting.findUnique({ where: { key: COMMISSION_KEY } });
    const percent = Number(typeof row?.value === "string" ? row.value : row?.value);
    return Number.isFinite(percent) && percent > 0 ? Math.min(100, percent) : 0;
}
