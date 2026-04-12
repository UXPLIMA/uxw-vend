"use client";
import { SettingsForm } from "../settings-form";
import { useTranslations } from "next-intl";

export default function HeroSettingsPage() {
    const t = useTranslations("admin");
    return (
        <SettingsForm
            title={t("hero_title")}
            subtitle={t("hero_subtitle")}
            fields={[
                { key: "hero_background_image", label: t("hero_backgroundImage"), type: "image" },
                { key: "hero_logo_image", label: t("hero_logoImage"), type: "image" },
                { key: "hero_logo_url", label: t("hero_logoUrl"), type: "url", placeholder: t("hero_logoUrlPlaceholder"), description: t("hero_logoUrlDesc") },
                { key: "hero_server_ip", label: t("hero_serverIp"), placeholder: "play.example.com" },
                { key: "hero_discord_url", label: t("hero_discordUrl"), type: "url", placeholder: "https://discord.gg/..." },
                { key: "hero_show_player_count", label: t("hero_showPlayerCount"), placeholder: "true", description: t("hero_showPlayerCountDesc") },
                { key: "hero_height", label: t("hero_height"), type: "number", placeholder: "280" },
            ]}
        />
    );
}
