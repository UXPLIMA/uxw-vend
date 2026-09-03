"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function XSettingsPage() {
    const t = useTranslations("xAuth");
    return (
        <AuthProviderSetup
            providerId="twitter"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://developer.x.com/en/portal/dashboard"
        />
    );
}
