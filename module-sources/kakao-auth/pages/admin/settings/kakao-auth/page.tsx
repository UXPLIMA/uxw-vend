"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function KakaoSettingsPage() {
    const t = useTranslations("kakaoAuth");
    return (
        <AuthProviderSetup
            providerId="kakao"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://developers.kakao.com/console/app"
        >
            <p className="text-muted-foreground">{t("adm_emailNote")}</p>
        </AuthProviderSetup>
    );
}
