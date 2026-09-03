"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function NaverSettingsPage() {
    const t = useTranslations("naverAuth");
    return (
        <AuthProviderSetup
            providerId="naver"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://developers.naver.com/apps/#/register"
        >
            <p className="text-muted-foreground">{t("adm_reviewNote")}</p>
        </AuthProviderSetup>
    );
}
