"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function IyzicoSettingsPage() {
    const t = useTranslations("iyzicoGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "iyzico_api_key", label: t("adm_apiKey"), placeholder: "sandbox-...", description: t("adm_apiKeyDesc") },
                { key: "iyzico_secret_key", label: t("adm_secretKey"), type: "password", placeholder: "sandbox-...", description: t("adm_secretKeyDesc") },
                { key: "iyzico_sandbox", label: t("adm_sandbox"), placeholder: "false", description: t("adm_sandboxDesc") },
            ]}
        />
    );
}
