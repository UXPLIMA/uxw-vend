"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function NowPaymentsSettingsPage() {
    const t = useTranslations("nowpaymentsGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "nowpayments_api_key", label: t("adm_apiKey"), type: "password", placeholder: "", description: t("adm_apiKeyDesc") },
                { key: "nowpayments_ipn_secret", label: t("adm_ipnSecret"), type: "password", placeholder: "", description: t("adm_ipnSecretDesc") },
            ]}
        />
    );
}
