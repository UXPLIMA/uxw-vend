"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function FaceitAuthSettingsPage() {
    const t = useTranslations("faceitAuth");
    return (
        <AuthProviderSetup
            providerId="faceit"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://developers.faceit.com/apps"
        />
    );
}
