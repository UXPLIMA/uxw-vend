"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Shield, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

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
        fetch("/api/v1/security/turnstile/settings")
            .then((r) => r.json())
            .then((d) => setConfig({
                siteKey: d.siteKey || "",
                secretKey: d.secretKey || "",
                enableOnLogin: !!d.enableOnLogin,
                enableOnRegister: !!d.enableOnRegister,
            }))
            .catch(() => toast.error(t("saveError")))
            .finally(() => setLoading(false));
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
                toast.error(data.error || t("saveError"));
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
            <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Shield className="w-7 h-7 text-orange-500" />
                    {t("title")}
                </h1>
                <p className="text-muted-foreground">{t("subtitle")}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label>{t("siteKey")}</Label>
                        <Input
                            value={config.siteKey}
                            onChange={(e) => setConfig({ ...config, siteKey: e.target.value })}
                            placeholder="0x..."
                        />
                    </div>
                    <div>
                        <Label>{t("secretKey")}</Label>
                        <Input
                            type="password"
                            value={config.secretKey}
                            onChange={(e) => setConfig({ ...config, secretKey: e.target.value })}
                            placeholder="0x..."
                        />
                    </div>
                    <div className="space-y-3 pt-2 border-t border-border">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.enableOnLogin}
                                onChange={(e) => setConfig({ ...config, enableOnLogin: e.target.checked })}
                                className="mt-1"
                            />
                            <div>
                                <div className="text-sm font-medium text-foreground">{t("enableOnLogin")}</div>
                                <div className="text-xs text-muted-foreground">{t("enableOnLoginDesc")}</div>
                            </div>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.enableOnRegister}
                                onChange={(e) => setConfig({ ...config, enableOnRegister: e.target.checked })}
                                className="mt-1"
                            />
                            <div>
                                <div className="text-sm font-medium text-foreground">{t("enableOnRegister")}</div>
                                <div className="text-xs text-muted-foreground">{t("enableOnRegisterDesc")}</div>
                            </div>
                        </label>
                    </div>
                    <Button onClick={save} disabled={saving} className="w-full">
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {t("save")}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
