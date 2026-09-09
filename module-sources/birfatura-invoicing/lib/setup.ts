/**
 * What the operator set up, read from where the settings screen writes it.
 *
 * Kept apart from `token.ts` and `order-answer.ts` so those stay importable
 * without dragging a server bundle behind them.
 */
import { prisma } from "@/core/sdk/server";

export const TOKEN_KEY = "birfatura_token";

export async function invoicingToken(): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key: TOKEN_KEY } });
    return typeof row?.value === "string" ? row.value.trim() : "";
}

export async function isConfigured(): Promise<boolean> {
    return (await invoicingToken()) !== "";
}

/** How the shop charges tax, as the store settings hold it. */
export async function taxSetup(): Promise<{ taxRate: number; taxIncluded: boolean }> {
    const { moduleSettings } = await import("@/core/sdk/server");
    const settings = await moduleSettings<{ taxRate?: number; taxIncluded?: boolean }>("store");
    const rate = Number(settings.taxRate);
    return {
        taxRate: Number.isFinite(rate) && rate > 0 ? rate : 0,
        taxIncluded: settings.taxIncluded === true,
    };
}
