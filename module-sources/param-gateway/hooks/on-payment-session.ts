/**
 * Opens Param's hosted payment page for an order.
 *
 * Param posts its result back to the success URL rather than sending the buyer
 * there with a query string, so the callback route is what both verifies the
 * payment and forwards the buyer. Where to forward them travels as a path in
 * the URL Param is given.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { log, resolveAppUrl } from "@/core/sdk/server";
import { callParam, getParamConfig, paramAmount, paramHash, readTag, xmlEscape } from "../lib/param";

/** Only the path of one of our own URLs travels through Param. */
function pathOf(url: string, fallback: string): string {
    try {
        const parsed = new URL(url);
        return `${parsed.pathname}${parsed.search}`;
    } catch {
        return fallback;
    }
}

const onPaymentSession: HookHandlerFor<"payment.session", "filter"> = async (result, request) => {
    if (result.handled || request.provider !== "param") return result;

    const config = await getParamConfig();
    if (!config) return result;
    if (request.currency.toUpperCase() !== "TRY") return result;

    if (request.recurring) {
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "Param cannot take subscriptions on this site yet. Pay another way.",
        };
    }

    try {
        const baseUrl = await resolveAppUrl();
        const success = pathOf(request.successUrl, "/store/order-success");
        const cancel = pathOf(request.cancelUrl, "/store/cart");
        const query = `?to=${encodeURIComponent(success)}&cancel=${encodeURIComponent(cancel)}`;
        const successUrl = `${baseUrl}/api/v1/param/callback${query}`;
        const failUrl = `${baseUrl}/api/v1/param/callback${query}&failed=1`;

        const amount = paramAmount(request.amount);
        const installments = "1";
        const hash = paramHash(
            config.clientCode + config.guid + installments + amount + amount + request.reference + failUrl + successUrl,
        );

        const xml = await callParam(
            config,
            "TP_Islem_Odeme_OnHazirlik",
            `<Islem_Tutar>${amount}</Islem_Tutar>` +
                `<Toplam_Tutar>${amount}</Toplam_Tutar>` +
                `<Siparis_ID>${xmlEscape(request.reference)}</Siparis_ID>` +
                `<Siparis_Aciklama>${xmlEscape(request.description.slice(0, 200))}</Siparis_Aciklama>` +
                `<Taksit>${installments}</Taksit>` +
                `<Islem_Hash>${xmlEscape(hash)}</Islem_Hash>` +
                `<Basarili_URL>${xmlEscape(successUrl)}</Basarili_URL>` +
                `<Hata_URL>${xmlEscape(failUrl)}</Hata_URL>` +
                `<Islem_ID></Islem_ID><IPAdr>127.0.0.1</IPAdr>` +
                `<Ref_URL>${xmlEscape(baseUrl)}</Ref_URL>` +
                `<Data1></Data1><Data2></Data2><Data3></Data3><Data4></Data4><Data5></Data5>`,
        );

        const outcome = Number(readTag(xml, "Sonuc") ?? "0");
        const url = readTag(xml, "UCD_URL");
        if (outcome <= 0 || !url) {
            log.error("[param-gateway] Param refused to open a payment page", {
                reference: request.reference,
                error: readTag(xml, "Sonuc_Str") ?? String(outcome),
            });
            return {
                handled: true,
                redirectUrl: null,
                reference: null,
                error: "The Param payment could not be started. Try again shortly.",
            };
        }

        return { handled: true, redirectUrl: url, reference: readTag(xml, "Islem_ID"), error: null };
    } catch (error) {
        log.error("[param-gateway] could not start a payment", {
            reference: request.reference,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            handled: true,
            redirectUrl: null,
            reference: null,
            error: "The Param payment could not be started. Try again shortly.",
        };
    }
};

export default onPaymentSession;
