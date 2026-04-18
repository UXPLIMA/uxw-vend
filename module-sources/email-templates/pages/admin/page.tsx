"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/components/admin/SettingsForm";

export default function EmailSettingsPage() {
    const t = useTranslations("emailTemplates");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "resend_api_key", label: t("adm_field1Label"), type: "password", placeholder: "re_...", description: t("adm_field1Desc") },
                { key: "email_from", label: t("adm_field2Label"), type: "email", placeholder: "noreply@yoursite.com" },
                { key: "email_from_name", label: t("adm_field3Label"), placeholder: "uxwVend" },
                { key: "email_welcome_subject", label: t("adm_field4Label"), placeholder: "Welcome to {appName}!", description: t("adm_field2Desc") },
                { key: "email_welcome_body", label: t("adm_field5Label"), type: "textarea", description: t("adm_field3Desc") },
                { key: "email_order_subject", label: t("adm_field6Label"), placeholder: "Order #{orderNumber}", description: t("adm_field4Desc") },
                { key: "email_reset_subject", label: t("adm_field7Label"), placeholder: "Reset your password" },
            ]}
        />
    );
}
