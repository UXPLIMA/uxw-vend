"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function AppleSettingsPage() {
    const t = useTranslations("appleAuth");
    return (
        <AuthProviderSetup
            providerId="apple"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://developer.apple.com/account/resources/identifiers/list/serviceId"
        >
            <p className="text-muted-foreground">{t("adm_keyNote")}</p>
            <p className="text-muted-foreground">{t("adm_nameNote")}</p>
        </AuthProviderSetup>
    );
}
