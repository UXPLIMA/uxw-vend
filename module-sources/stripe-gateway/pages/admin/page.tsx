"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function StripeSettingsPage() {
    const t = useTranslations("stripeGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "stripe_public_key", label: t("adm_field1Label"), placeholder: "pk_...", description: t("adm_field1Desc") },
                { key: "stripe_secret_key", label: t("adm_field2Label"), type: "password", placeholder: "sk_...", description: t("adm_field2Desc") },
                { key: "stripe_webhook_secret", label: t("adm_field3Label"), type: "password", placeholder: "whsec_...", description: t("adm_field3Desc") },
                {
                    key: "stripe_fee_pass",
                    label: t("adm_feePassLabel"),
                    type: "select",
                    options: [
                        { value: "false", label: t("adm_feePassOff") },
                        { value: "true", label: t("adm_feePassOn") },
                    ],
                    description: t("adm_feePassDesc"),
                },
                { key: "stripe_fee_percent", label: t("adm_feePercentLabel"), type: "number", placeholder: "2.9", description: t("adm_feePercentDesc") },
                { key: "stripe_fee_fixed", label: t("adm_feeFixedLabel"), type: "number", placeholder: "0.25", description: t("adm_feeFixedDesc") },
            ]}
        />
    );
}
