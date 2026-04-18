"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/components/admin/SettingsForm";

export default function GoogleAuthSettingsPage() {
    const t = useTranslations("googleAuth");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "google_client_id", label: t("adm_field1Label"), placeholder: "xxxx.apps.googleusercontent.com", description: t("adm_field1Desc") },
                { key: "google_client_secret", label: t("adm_field2Label"), type: "password", placeholder: "Your client secret", description: t("adm_field2Desc") },
                { key: "google_redirect_uri", label: t("adm_field3Label"), type: "url", placeholder: "https://yoursite.com/api/auth/callback/google", description: t("adm_field3Desc") },
            ]}
        />
    );
}
