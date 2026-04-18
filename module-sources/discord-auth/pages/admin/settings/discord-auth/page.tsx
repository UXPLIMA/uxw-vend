"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/components/admin/SettingsForm";

export default function DiscordAuthSettingsPage() {
    const t = useTranslations("discordAuth");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "discord_client_id", label: t("adm_field1Label"), placeholder: "123456789012345678", description: t("adm_field1Desc") },
                { key: "discord_client_secret", label: t("adm_field2Label"), type: "password", placeholder: "Your client secret", description: t("adm_field2Desc") },
                { key: "discord_redirect_uri", label: t("adm_field3Label"), type: "url", placeholder: "https://yoursite.com/api/auth/callback/discord", description: t("adm_field3Desc") },
            ]}
        />
    );
}
