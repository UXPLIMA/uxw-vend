"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

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
            ]}
        />
    );
}
