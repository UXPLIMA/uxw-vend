"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function MollieSettingsPage() {
    const t = useTranslations("mollieGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "mollie_api_key", label: t("adm_apiKey"), type: "password", placeholder: "live_...", description: t("adm_apiKeyDesc") },
            ]}
        />
    );
}
