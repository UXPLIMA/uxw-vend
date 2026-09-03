"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function GitHubAuthSettingsPage() {
    const t = useTranslations("githubAuth");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "github_client_id", label: t("adm_field1Label"), description: t("adm_field1Desc") },
                { key: "github_client_secret", label: t("adm_field2Label"), type: "password", description: t("adm_field2Desc") },
                { key: "github_redirect_uri", label: t("adm_field3Label"), type: "url", placeholder: "https://yoursite.com/api/auth/callback/github", description: t("adm_field3Desc") },
            ]}
        />
    );
}
