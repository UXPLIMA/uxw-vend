"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function PaysafecardSettingsPage() {
    const t = useTranslations("paysafecardGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "paysafecard_api_key", label: t("adm_apiKey"), type: "password", placeholder: "psc_...", description: t("adm_apiKeyDesc") },
                { key: "paysafecard_test_mode", label: t("adm_sandbox"), placeholder: "false", description: t("adm_sandboxDesc") },
            ]}
        />
    );
}
