"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function TikTokSettingsPage() {
    const t = useTranslations("tiktokAuth");
    return (
        <AuthProviderSetup
            providerId="tiktok"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://developers.tiktok.com/apps"
        />
    );
}
