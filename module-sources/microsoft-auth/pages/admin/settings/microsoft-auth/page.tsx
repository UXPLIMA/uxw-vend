"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function MicrosoftSettingsPage() {
    const t = useTranslations("microsoftAuth");
    return (
        <AuthProviderSetup
            providerId="microsoft-entra-id"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://entra.microsoft.com"
        >
            <p className="text-muted-foreground">{t("adm_tenantNote")}</p>
        </AuthProviderSetup>
    );
}
