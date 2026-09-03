"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function PatreonSettingsPage() {
    const t = useTranslations("patreonAuth");
    return (
        <AuthProviderSetup
            providerId="patreon"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://www.patreon.com/portal/registration/register-clients"
        />
    );
}
