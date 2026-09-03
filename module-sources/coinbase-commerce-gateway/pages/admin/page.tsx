"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function CoinbaseCommerceSettingsPage() {
    const t = useTranslations("coinbaseCommerceGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "coinbase_api_key", label: t("adm_apiKey"), type: "password", placeholder: "", description: t("adm_apiKeyDesc") },
                { key: "coinbase_webhook_secret", label: t("adm_webhookSecret"), type: "password", placeholder: "", description: t("adm_webhookSecretDesc") },
            ]}
        />
    );
}
