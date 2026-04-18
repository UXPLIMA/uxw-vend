"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/components/admin/SettingsForm";

export default function PaymentSettingsPage() {
    const t = useTranslations("store");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "stripe_public_key", label: t("adm_field1Label"), placeholder: "pk_...", description: t("adm_field1Desc") },
                { key: "stripe_secret_key", label: t("adm_field2Label"), type: "password", placeholder: "sk_...", description: t("adm_field2Desc") },
                { key: "stripe_webhook_secret", label: t("adm_field3Label"), type: "password", placeholder: "whsec_...", description: t("adm_field3Desc") },
                { key: "default_currency", label: t("adm_field4Label"), placeholder: "usd", description: t("adm_field4Desc") },
                { key: "tax_rate", label: t("adm_field5Label"), type: "number", placeholder: "0", description: t("adm_field5Desc") },
            ]}
        />
    );
}
