"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function FacebookSettingsPage() {
    const t = useTranslations("facebookAuth");
    return (
        <AuthProviderSetup
            providerId="facebook"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://developers.facebook.com/apps"
        />
    );
}
