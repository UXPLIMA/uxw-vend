"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function SpotifySettingsPage() {
    const t = useTranslations("spotifyAuth");
    return (
        <AuthProviderSetup
            providerId="spotify"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://developer.spotify.com/dashboard"
        />
    );
}
