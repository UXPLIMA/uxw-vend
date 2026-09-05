"use client";

/**
 * The settings page for a module that adds a way to sign in.
 *
 * There is nothing to save here, and that is the point. Auth.js assembles its
 * provider list when the process starts, so the credentials have to be in the
 * environment before the app boots - a form writing them to the settings table
 * would look like it worked and change nothing. What an admin needs instead is
 * the two facts this panel shows: which variables to set, and the redirect URL
 * to register with the provider.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/core/components/ui/card";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { AdminPageHeader } from "@/core/components/admin/AdminPageHeader";

interface ProviderStatus {
    id: string;
    module: string;
    envVars: string[];
    missing: string[];
    configured: boolean;
    callbackUrl: string | null;
}

export interface AuthProviderSetupProps {
    /** The provider id the module declared, e.g. "discord". */
    providerId: string;
    title: string;
    subtitle?: string;
    /** Where to create the application, shown as a plain link. */
    consoleUrl?: string;
    /** Extra rows a provider with an unusual setup wants to add. */
    children?: React.ReactNode;
}

function Row({ label, value, help }: { label: string; value: string; help: string }) {
    return (
        <div>
            <p className="font-medium text-foreground">{label}</p>
            <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">{value}</code>
            <p className="mt-1 text-muted-foreground">{help}</p>
        </div>
    );
}

export function AuthProviderSetup({
    providerId,
    title,
    subtitle,
    consoleUrl,
    children,
}: AuthProviderSetupProps) {
    const t = useTranslations("authProvider");
    const [status, setStatus] = useState<ProviderStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let active = true;
        fetch("/api/v1/auth-providers/status")
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error("status"))))
            .then((data: { providers: ProviderStatus[] }) => {
                if (!active) return;
                setStatus(data.providers.find((p) => p.id === providerId) ?? null);
            })
            .catch(() => active && setError(true))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [providerId]);

    return (
        <div className="space-y-6">
            <AdminPageHeader title={title} description={subtitle} className="mb-0" />

            <Card>
                <CardContent className="space-y-5 p-6 text-sm">
                    {loading && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t("loading")}
                        </p>
                    )}

                    {!loading && (error || !status) && <p className="text-destructive">{t("statusError")}</p>}

                    {!loading && !error && status && (
                        <>
                            {status.configured ? (
                                <p className="flex items-center gap-2 text-success">
                                    <Check className="h-4 w-4" />
                                    {t("active")}
                                </p>
                            ) : (
                                <p className="flex items-center gap-2 text-warning">
                                    <TriangleAlert className="h-4 w-4" />
                                    {t("inactive")}
                                </p>
                            )}

                            <div>
                                <p className="font-medium text-foreground">{t("envVarsLabel")}</p>
                                <ul className="mt-1 space-y-1">
                                    {status.envVars.map((name) => (
                                        <li key={name} className="flex items-center gap-2">
                                            <code className="rounded bg-muted px-2 py-1 text-xs">{name}</code>
                                            <span
                                                className={
                                                    status.missing.includes(name)
                                                        ? "text-warning"
                                                        : "text-success"
                                                }
                                            >
                                                {status.missing.includes(name) ? t("notSet") : t("set")}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-1 text-muted-foreground">{t("envVarsHelp")}</p>
                            </div>

                            {status.callbackUrl && (
                                <Row
                                    label={t("callbackLabel")}
                                    value={status.callbackUrl}
                                    help={t("callbackHelp")}
                                />
                            )}

                            {consoleUrl && (
                                <p className="text-muted-foreground">
                                    {t("consoleHelp")}{" "}
                                    <a
                                        href={consoleUrl}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="text-primary hover:underline"
                                    >
                                        {consoleUrl}
                                    </a>
                                </p>
                            )}

                            {children}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
