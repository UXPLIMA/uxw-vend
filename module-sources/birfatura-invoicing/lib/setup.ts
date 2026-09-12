/**
 * What the operator set up, read from where the settings screen writes it.
 *
 * Kept apart from `token.ts` and `order-answer.ts` so those stay importable
 * without dragging a server bundle behind them.
 */
import { readSettingStrings } from "@/core/sdk/server";

export const TOKEN_KEY = "birfatura_token";

export async function invoicingToken(): Promise<string> {
    // Through the SDK rather than off the row. The credentials among these
    // keys are encrypted at rest, so a direct read returns ciphertext and
    // the provider rejects it as if the operator had mistyped the key.
    const values = await readSettingStrings([TOKEN_KEY]);
    return values[TOKEN_KEY] ?? "";
}

export async function isConfigured(): Promise<boolean> {
    return (await invoicingToken()) !== "";
}

/** How the shop charges tax, as the store settings hold it. */
export async function taxSetup(): Promise<{ taxRate: number; taxIncluded: boolean; timeZone: string }> {
    const { moduleSettings, siteTimeZone } = await import("@/core/sdk/server");
    const settings = await moduleSettings<{ taxRate?: number; taxIncluded?: boolean }>("store");
    const rate = Number(settings.taxRate);
    return {
        taxRate: Number.isFinite(rate) && rate > 0 ? rate : 0,
        taxIncluded: settings.taxIncluded === true,
        // Every date crossing this boundary is written in the shop's own time
        // zone, which is what the integrator's `dd.MM.yyyy HH:mm:ss` means.
        timeZone: await siteTimeZone(),
    };
}
