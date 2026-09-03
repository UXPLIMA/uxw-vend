"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function YandexSettingsPage() {
    const t = useTranslations("yandexAuth");
    return (
        <AuthProviderSetup
            providerId="yandex"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://oauth.yandex.com/client/new"
        >
            <p className="text-muted-foreground">{t("adm_scopeNote")}</p>
        </AuthProviderSetup>
    );
}
