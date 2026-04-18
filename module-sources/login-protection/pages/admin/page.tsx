"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/components/admin/SettingsForm";

export default function SecuritySettingsPage() {
    const t = useTranslations("loginProtection");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "enable_email_verification", label: t("adm_field5Label"), placeholder: "false", description: t("adm_field5Desc") },
                { key: "max_login_attempts", label: t("adm_field6Label"), type: "number", placeholder: "10", description: t("adm_field6Desc") },
            ]}
        />
    );
}
