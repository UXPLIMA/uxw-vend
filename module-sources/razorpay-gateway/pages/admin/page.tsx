"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function RazorpaySettingsPage() {
    const t = useTranslations("razorpayGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "razorpay_key_id", label: t("adm_keyId"), placeholder: "rzp_live_...", description: t("adm_keyIdDesc") },
                { key: "razorpay_key_secret", label: t("adm_keySecret"), type: "password", placeholder: "", description: t("adm_keySecretDesc") },
                { key: "razorpay_webhook_secret", label: t("adm_webhookSecret"), type: "password", placeholder: "", description: t("adm_webhookSecretDesc") },
            ]}
        />
    );
}
