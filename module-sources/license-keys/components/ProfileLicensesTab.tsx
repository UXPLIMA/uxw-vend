"use client";

/**
 * The customer's own keys.
 *
 * A key is worth nothing to its owner unless they can read it, so this is the
 * one screen that shows the plaintext. It is masked until asked for, because
 * people open their account page while streaming or sharing a screen.
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent, CardHeader, CardTitle, useLocalDate } from "@/core/sdk/ui";
import { Loader2, KeyRound, Copy, Check, Eye, EyeOff, Monitor } from "lucide-react";

interface Activation {
    id: string;
    label: string | null;
    activatedAt: string;
    lastSeenAt: string;
}

interface License {
    id: string;
    key: string;
    productName: string | null;
    status: string;
    expiresAt: string | null;
    maxActivations: number;
    activations: Activation[];
    createdAt: string;
}

export function ProfileLicensesTab() {
    const t = useTranslations("licenseKeys");
    const formatLocalDate = useLocalDate();
    const [licenses, setLicenses] = useState<License[]>([]);
    const [loading, setLoading] = useState(true);
    const [shown, setShown] = useState<Set<string>>(new Set());
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/v1/licenses");
            if (res.ok) {
                const data = await res.json();
                setLicenses(data.licenses || []);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const toggle = (id: string) => {
        setShown((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const copy = (license: License) => {
        navigator.clipboard.writeText(license.key);
        setCopiedId(license.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("loading")}
            </div>
        );
    }

    if (licenses.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5" />
                        {t("title")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{t("empty")}</CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {licenses.map((license) => {
                const expired = license.expiresAt ? new Date(license.expiresAt).getTime() < Date.now() : false;
                const visible = shown.has(license.id);
                return (
                    <Card key={license.id}>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between gap-2 text-base">
                                <span className="flex items-center gap-2">
                                    <KeyRound className="h-4 w-4" />
                                    {license.productName || t("untitledProduct")}
                                </span>
                                {license.status !== "active" ? (
                                    <span className="text-sm font-normal text-destructive">{t("revoked")}</span>
                                ) : expired ? (
                                    <span className="text-sm font-normal text-destructive">{t("expired")}</span>
                                ) : null}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <code className="rounded bg-muted px-3 py-2 font-mono text-sm tracking-wider">
                                    {visible ? license.key : t("hidden")}
                                </code>
                                <Button variant="outline" size="sm" onClick={() => toggle(license.id)}>
                                    {visible ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                                    {t(visible ? "hide" : "reveal")}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => copy(license)}>
                                    {copiedId === license.id ? (
                                        <Check className="mr-2 h-4 w-4" />
                                    ) : (
                                        <Copy className="mr-2 h-4 w-4" />
                                    )}
                                    {t("copy")}
                                </Button>
                            </div>

                            <p className="text-sm text-muted-foreground">
                                {t("activationsUsed", {
                                    used: license.activations.length,
                                    max: license.maxActivations,
                                })}
                                {license.expiresAt
                                    ? ` - ${t("expiresOn", { date: formatLocalDate(license.expiresAt) })}`
                                    : ""}
                            </p>

                            {license.activations.length > 0 && (
                                <ul className="space-y-1 text-sm text-muted-foreground">
                                    {license.activations.map((activation) => (
                                        <li key={activation.id} className="flex items-center gap-2">
                                            <Monitor className="h-3.5 w-3.5" />
                                            <span>{activation.label || t("unnamedMachine")}</span>
                                            <span className="text-xs">
                                                {formatLocalDate(activation.lastSeenAt)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
