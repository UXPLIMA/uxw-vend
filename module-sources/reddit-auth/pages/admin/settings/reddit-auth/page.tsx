"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function RedditSettingsPage() {
    const t = useTranslations("redditAuth");
    return (
        <AuthProviderSetup
            providerId="reddit"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://www.reddit.com/prefs/apps"
        />
    );
}
