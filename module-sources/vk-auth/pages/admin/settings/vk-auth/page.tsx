"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function VkSettingsPage() {
    const t = useTranslations("vkAuth");
    return (
        <AuthProviderSetup
            providerId="vk"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://dev.vk.com/admin/apps-list"
        >
            <p className="text-muted-foreground">{t("adm_emailNote")}</p>
        </AuthProviderSetup>
    );
}
