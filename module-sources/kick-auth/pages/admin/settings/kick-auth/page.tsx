"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function KickSettingsPage() {
    const t = useTranslations("kickAuth");
    return (
        <AuthProviderSetup
            providerId="kick"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://kick.com/settings/developer"
        >
            <p className="text-muted-foreground">{t("adm_scopeNote")}</p>
        </AuthProviderSetup>
    );
}
