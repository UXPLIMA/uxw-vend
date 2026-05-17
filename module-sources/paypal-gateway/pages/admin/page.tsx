"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/components/admin/SettingsForm";

export default function PayPalSettingsPage() {
    const t = useTranslations("paypalGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "paypal_client_id", label: t("adm_field1Label"), placeholder: "AW...", description: t("adm_field1Desc") },
                { key: "paypal_client_secret", label: t("adm_field2Label"), type: "password", placeholder: "EL...", description: t("adm_field2Desc") },
                {
                    key: "paypal_mode",
                    label: t("adm_field3Label"),
                    type: "select",
                    defaultValue: "sandbox",
                    description: t("adm_field3Desc"),
                    options: [
                        { value: "sandbox", label: "Sandbox (test)" },
                        { value: "live", label: "Live (production)" },
                    ],
                },
            ]}
        />
    );
}
