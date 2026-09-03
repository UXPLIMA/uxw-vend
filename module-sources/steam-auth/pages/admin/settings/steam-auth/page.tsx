"use client";

/**
 * Steam login is configured with an env var, not a database setting, so this
 * page is a status readout rather than a form. Auth.js assembles its provider
 * list synchronously at startup, before any query can run, which is why the
 * key cannot live in the settings table like most module configuration does.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/core/sdk/ui";

interface SteamStatus {
    configured: boolean;
    envVar: string;
    realm: string;
    returnTo: string;
}

export default function SteamAuthSettingsPage() {
    const t = useTranslations("steamAuth");
    const [status, setStatus] = useState<SteamStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/v1/steam-auth/status")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => setStatus(data))
            .catch(() => setStatus(null))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-foreground">{t("adm_title")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("adm_subtitle")}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("adm_statusTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    {loading && <p className="text-muted-foreground">{t("adm_loading")}</p>}
                    {!loading && !status && <p className="text-destructive">{t("adm_statusError")}</p>}
                    {!loading && status && (
                        <>
                            <p className={status.configured ? "text-green-500" : "text-amber-500"}>
                                {status.configured ? t("adm_configured") : t("adm_notConfigured")}
                            </p>
                            <div>
                                <p className="font-medium text-foreground">{t("adm_envVarLabel")}</p>
                                <code className="block mt-1 rounded bg-muted px-2 py-1 text-xs">{status.envVar}</code>
                                <p className="text-muted-foreground mt-1">{t("adm_envVarHelp")}</p>
                            </div>
                            <div>
                                <p className="font-medium text-foreground">{t("adm_returnToLabel")}</p>
                                <code className="block mt-1 rounded bg-muted px-2 py-1 text-xs break-all">
                                    {status.returnTo}
                                </code>
                                <p className="text-muted-foreground mt-1">{t("adm_returnToHelp")}</p>
                            </div>
                            <div>
                                <p className="font-medium text-foreground">{t("adm_realmLabel")}</p>
                                <code className="block mt-1 rounded bg-muted px-2 py-1 text-xs break-all">
                                    {status.realm}
                                </code>
                                <p className="text-muted-foreground mt-1">{t("adm_realmHelp")}</p>
                            </div>
                            <p className="text-muted-foreground">{t("adm_emailNote")}</p>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
