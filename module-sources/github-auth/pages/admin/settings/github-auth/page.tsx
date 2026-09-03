"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function GitHubAuthSettingsPage() {
    const t = useTranslations("githubAuth");
    return (
        <AuthProviderSetup
            providerId="github"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://github.com/settings/developers"
        />
    );
}
