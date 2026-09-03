"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function GoogleAuthSettingsPage() {
    const t = useTranslations("googleAuth");
    return (
        <AuthProviderSetup
            providerId="google"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://console.cloud.google.com/apis/credentials"
        />
    );
}
