"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function MercadoPagoSettingsPage() {
    const t = useTranslations("mercadopagoGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "mercadopago_access_token", label: t("adm_accessToken"), type: "password", placeholder: "APP_USR-...", description: t("adm_accessTokenDesc") },
                { key: "mercadopago_webhook_secret", label: t("adm_webhookSecret"), type: "password", placeholder: "", description: t("adm_webhookSecretDesc") },
            ]}
        />
    );
}
