"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function InstagramSettingsPage() {
    const t = useTranslations("instagramAuth");
    return (
        <AuthProviderSetup
            providerId="instagram"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://developers.facebook.com/apps"
        >
            <p className="text-muted-foreground">{t("adm_apiNote")}</p>
            <p className="text-muted-foreground">{t("adm_accountNote")}</p>
        </AuthProviderSetup>
    );
}
