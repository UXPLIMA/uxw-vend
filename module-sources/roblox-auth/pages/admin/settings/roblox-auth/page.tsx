"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function RobloxAuthSettingsPage() {
    const t = useTranslations("robloxAuth");
    return (
        <AuthProviderSetup
            providerId="roblox"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://create.roblox.com/dashboard/credentials"
        />
    );
}
