"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Cloud, Loader2, Save, Check } from "lucide-react";
import { toast } from "sonner";

interface R2Config {
    accountId: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    publicUrl: string;
}

export default function CloudflareR2AdminPage() {
    const t = useTranslations("cloudflareR2");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [setActive, setSetActive] = useState(false);
    const [config, setConfig] = useState<R2Config>({
        accountId: "",
        bucket: "",
        accessKey: "",
        secretKey: "",
        publicUrl: "",
    });

    useEffect(() => {
        fetch("/api/v1/storage/cloudflare-r2/settings")
            .then((r) => r.json())
            .then((d) => {
                if (d.config) setConfig(d.config);
                setIsActive(!!d.isActive);
                setSetActive(!!d.isActive);
            })
            .catch(() => toast.error(t("saveError")))
            .finally(() => setLoading(false));
    }, [t]);

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/v1/storage/cloudflare-r2/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...config, setActive }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || t("saveError"));
                return;
            }
            toast.success(t("saved"));
            if (setActive) setIsActive(true);
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
                    <Cloud className="w-7 h-7 text-orange-500" />
                    {t("title")}
                </h1>
                <p className="text-muted-foreground">{t("subtitle")}</p>
                {isActive && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded">
                        <Check className="w-3.5 h-3.5" />
                        {t("currentlyActive")}
                    </div>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label>{t("accountId")}</Label>
                        <Input
                            value={config.accountId}
                            onChange={(e) => setConfig({ ...config, accountId: e.target.value })}
                            placeholder="abc123def456..."
                        />
                    </div>
                    <div>
                        <Label>{t("bucket")}</Label>
                        <Input
                            value={config.bucket}
                            onChange={(e) => setConfig({ ...config, bucket: e.target.value })}
                            placeholder="my-bucket"
                        />
                    </div>
                    <div>
                        <Label>{t("accessKey")}</Label>
                        <Input
                            value={config.accessKey}
                            onChange={(e) => setConfig({ ...config, accessKey: e.target.value })}
                            placeholder="..."
                        />
                    </div>
                    <div>
                        <Label>{t("secretKey")}</Label>
                        <Input
                            type="password"
                            value={config.secretKey}
                            onChange={(e) => setConfig({ ...config, secretKey: e.target.value })}
                            placeholder="..."
                        />
                    </div>
                    <div>
                        <Label>{t("publicUrl")}</Label>
                        <Input
                            value={config.publicUrl}
                            onChange={(e) => setConfig({ ...config, publicUrl: e.target.value })}
                            placeholder="https://pub-xxx.r2.dev"
                        />
                        <p className="text-xs text-muted-foreground mt-1">{t("publicUrlHint")}</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={setActive}
                            onChange={(e) => setSetActive(e.target.checked)}
                        />
                        <span className="text-sm">{t("active")}</span>
                    </label>
                    <Button onClick={save} disabled={saving} className="w-full">
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {saving ? t("saving") : t("save")}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
