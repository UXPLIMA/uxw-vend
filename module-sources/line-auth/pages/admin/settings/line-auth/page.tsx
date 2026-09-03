"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function LineSettingsPage() {
    const t = useTranslations("lineAuth");
    return (
        <AuthProviderSetup
            providerId="line"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://developers.line.biz/console/"
        >
            <p className="text-muted-foreground">{t("adm_emailNote")}</p>
        </AuthProviderSetup>
    );
}
