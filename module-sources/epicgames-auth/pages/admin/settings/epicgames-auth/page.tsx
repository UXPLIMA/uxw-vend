"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function EpicgamesSettingsPage() {
    const t = useTranslations("epicgamesAuth");
    return (
        <AuthProviderSetup
            providerId="epicgames"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://dev.epicgames.com/portal"
        >
            <p className="text-muted-foreground">{t("adm_scopeNote")}</p>
            <p className="text-muted-foreground">{t("adm_emailNote")}</p>
        </AuthProviderSetup>
    );
}
