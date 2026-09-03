"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function DiscordAuthSettingsPage() {
    const t = useTranslations("discordAuth");
    return (
        <AuthProviderSetup
            providerId="discord"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://discord.com/developers/applications"
        />
    );
}
