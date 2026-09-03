"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function PaytrSettingsPage() {
    const t = useTranslations("paytrGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "paytr_merchant_id", label: t("adm_merchantId"), placeholder: "123456", description: t("adm_merchantIdDesc") },
                { key: "paytr_merchant_key", label: t("adm_merchantKey"), type: "password", placeholder: "", description: t("adm_merchantKeyDesc") },
                { key: "paytr_merchant_salt", label: t("adm_merchantSalt"), type: "password", placeholder: "", description: t("adm_merchantSaltDesc") },
                { key: "paytr_test_mode", label: t("adm_sandbox"), placeholder: "false", description: t("adm_sandboxDesc") },
            ]}
        />
    );
}
