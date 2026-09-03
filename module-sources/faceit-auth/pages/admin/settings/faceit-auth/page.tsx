"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function FACEITAuthSettingsPage() {
    const t = useTranslations("faceitAuth");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "faceit_client_id", label: t("adm_field1Label"), description: t("adm_field1Desc") },
                { key: "faceit_client_secret", label: t("adm_field2Label"), type: "password", description: t("adm_field2Desc") },
                { key: "faceit_redirect_uri", label: t("adm_field3Label"), type: "url", placeholder: "https://yoursite.com/api/auth/callback/faceit", description: t("adm_field3Desc") },
            ]}
        />
    );
}
