/**
 * Where Param sends the buyer back, and posts the result.
 *
 * @provider-callback: the posted fields are treated as a hint only. The
 * payment is looked up at Param with this site's own terminal credentials
 * before anything is settled, so a forged post grants nothing.
 *
 * Param does publish a hash on the callback, but which fields go into it
 * differs between its integrations, and a verification that might be wrong is
 * worse than one that is not there: this route asks Param instead.
 */
import { NextRequest, NextResponse } from "next/server";
import { applyFiltersAsync } from "@/core/sdk";
import { log, resolveAppUrl } from "@/core/sdk/server";
import { callParam, getParamConfig, parseParamAmount, readTag, xmlEscape } from "../../lib/param";

export const dynamic = "force-dynamic";

const UNHANDLED: PaymentOutcome = { handled: false, duplicate: false, error: null };

function safePath(value: string | null, fallback: string): string {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
    return value;
}

async function goTo(path: string): Promise<NextResponse> {
    return NextResponse.redirect(new URL(path, await resolveAppUrl()), 303);
}

function withError(path: string, code: string): string {
    return `${path}${path.includes("?") ? "&" : "?"}error=${code}`;
}

export async function POST(request: NextRequest) {
    const success = safePath(request.nextUrl.searchParams.get("to"), "/store/order-success");
    const cancel = safePath(request.nextUrl.searchParams.get("cancel"), "/store/cart");

    const form = await request.formData();
    const reference = String(form.get("TURKPOS_RETVAL_Siparis_ID") ?? "");
    const receiptId = String(form.get("TURKPOS_RETVAL_Dekont_ID") ?? "");
    if (!reference) return goTo(withError(cancel, "missing_order"));

    const config = await getParamConfig();
    if (!config) return goTo(withError(cancel, "not_configured"));

    try {
        const xml = await callParam(
            config,
            "TP_Islem_Sorgulama4",
            `<Dekont_ID>${xmlEscape(receiptId)}</Dekont_ID>` +
                `<Siparis_ID>${xmlEscape(reference)}</Siparis_ID>` +
                `<Islem_ID></Islem_ID>`,
        );

        const outcome = Number(readTag(xml, "Sonuc") ?? "0");
        const state = (readTag(xml, "Durum") ?? "").toUpperCase();
        const paid = outcome > 0 && (state === "SATIS" || state === "BASARILI" || state === "İŞLEM BAŞARILI");

        if (!paid) {
            const voided = await applyFiltersAsync("payment.voided", UNHANDLED, {
                kind: "order",
                reference,
                provider: "param",
            });
            if (!voided.handled) log.warn("[param-gateway] nothing cancelled an unpaid order", { reference });
            return goTo(withError(cancel, "payment_failed"));
        }

        const amount = parseParamAmount(readTag(xml, "Toplam_Tutar") ?? readTag(xml, "Odeme_Tutari") ?? "0");
        const settled = await applyFiltersAsync("payment.settled", UNHANDLED, {
            kind: "order",
            reference,
            provider: "param",
            providerRef: receiptId || reference,
            amount,
            currency: "TRY",
        });

        if (!settled.handled) {
            log.error("[param-gateway] settled a payment nothing handled", { reference, receiptId });
            return goTo(withError(cancel, "settlement_failed"));
        }

        return goTo(success);
    } catch (error) {
        log.error("[param-gateway] could not verify a payment", {
            reference,
            error: error instanceof Error ? error.message : String(error),
        });
        return goTo(withError(cancel, "verification_failed"));
    }
}
