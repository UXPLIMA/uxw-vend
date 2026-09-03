"use client";

import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

export default function BattlenetSettingsPage() {
    const t = useTranslations("battlenetAuth");
    return (
        <AuthProviderSetup
            providerId="battlenet"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://develop.battle.net/access/clients"
        >
            <p className="text-muted-foreground">{t("adm_issuerNote")}</p>
            <p className="text-muted-foreground">{t("adm_emailNote")}</p>
        </AuthProviderSetup>
    );
}
