"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function TwitchAuthSettingsPage() {
    const t = useTranslations("twitchAuth");
    return (
        <AuthProviderSetup
            providerId="twitch"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://dev.twitch.tv/console/apps"
        />
    );
}
