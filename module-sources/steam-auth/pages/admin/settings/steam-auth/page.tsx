"use client";

/**
 * Steam's setup differs from every other sign-in module: there is no OAuth
 * redirect URL to register, because the flow is OpenID 2.0. What Steam wants
 * instead is a domain and a return URL, so those two rows are added to the
 * standard provider panel.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AuthProviderSetup } from "@/core/sdk/admin";

interface SteamUrls {
    realm: string;
    returnTo: string;
}

function SteamUrlRows() {
    const t = useTranslations("steamAuth");
    const [urls, setUrls] = useState<SteamUrls | null>(null);

    useEffect(() => {
        let active = true;
        fetch("/api/v1/steam-auth/status")
            .then((res) => (res.ok ? res.json() : null))
            .then((data: SteamUrls | null) => active && setUrls(data))
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, []);

    if (!urls) return null;

    return (
        <>
            <div>
                <p className="font-medium text-foreground">{t("adm_returnToLabel")}</p>
                <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">{urls.returnTo}</code>
                <p className="mt-1 text-muted-foreground">{t("adm_returnToHelp")}</p>
            </div>
            <div>
                <p className="font-medium text-foreground">{t("adm_realmLabel")}</p>
                <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">{urls.realm}</code>
                <p className="mt-1 text-muted-foreground">{t("adm_realmHelp")}</p>
            </div>
            <p className="text-muted-foreground">{t("adm_emailNote")}</p>
        </>
    );
}

export default function SteamAuthSettingsPage() {
    const t = useTranslations("steamAuth");
    return (
        <AuthProviderSetup
            providerId="steam"
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            consoleUrl="https://steamcommunity.com/dev/apikey"
        >
            <SteamUrlRows />
        </AuthProviderSetup>
    );
}
