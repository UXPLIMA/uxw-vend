"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, CheckboxField } from "@/core/sdk/ui";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/core/sdk/admin";
import { errorMessage } from "@/core/sdk";

interface TurnstileConfig {
    siteKey: string;
    secretKey: string;
    enableOnLogin: boolean;
    enableOnRegister: boolean;
}

export default function CloudflareTurnstileAdminPage() {
    const t = useTranslations("cloudflareTurnstile");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<TurnstileConfig>({
        siteKey: "",
        secretKey: "",
        enableOnLogin: false,
        enableOnRegister: false,
    });

    useEffect(() => {
        let cancelled = false;
        fetch("/api/v1/security/turnstile/settings")
            .then((r) => r.json())
            .then((d) => {
                if (cancelled) return;
                setConfig({
                    siteKey: d.siteKey || "",
                    secretKey: d.secretKey || "",
                    enableOnLogin: !!d.enableOnLogin,
                    enableOnRegister: !!d.enableOnRegister,
                });
            })
            .catch(() => toast.error(t("saveError")))
            .finally(() => {
                if (cancelled) return;
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [t]);

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/v1/security/turnstile/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(errorMessage(data, t("saveError"), t));
                return;
            }
            toast.success(t("saved"));
        } catch {
            toast.error(t("saveError"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl">
            {/* The save is a header action, the same control in the same
                place as every other settings screen, rather than a full-width
                button pinned to the bottom of the card. */}
            <AdminPageHeader
                title={t("title")}
                description={t("subtitle")}
                actions={
                    <Button onClick={save} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {t("save")}
                    </Button>
                }
            />

            <Card>
                <CardHeader>
                    <CardTitle>{t("title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label>{t("siteKey")}</Label>
                        <Input
                            aria-label={t("siteKey")}
                            value={config.siteKey}
                            onChange={(e) => setConfig({ ...config, siteKey: e.target.value })}
                            placeholder="0x..."
                        />
                    </div>
                    <div>
                        <Label>{t("secretKey")}</Label>
                        <Input
                            aria-label={t("secretKey")}
                            type="password"
                            value={config.secretKey}
                            onChange={(e) => setConfig({ ...config, secretKey: e.target.value })}
                            placeholder="0x..."
                        />
                    </div>
                    <div className="space-y-3 pt-2 border-t border-border">
                        <CheckboxField
                            checked={config.enableOnLogin}
                            onChange={(e) => setConfig({ ...config, enableOnLogin: e.target.checked })}
                            label={<span className="font-medium">{t("enableOnLogin")}</span>}
                            description={t("enableOnLoginDesc")}
                        />
                        <CheckboxField
                            checked={config.enableOnRegister}
                            onChange={(e) => setConfig({ ...config, enableOnRegister: e.target.checked })}
                            label={<span className="font-medium">{t("enableOnRegister")}</span>}
                            description={t("enableOnRegisterDesc")}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
