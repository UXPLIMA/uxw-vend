"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, CheckboxField, Badge } from "@/core/sdk/ui";
import { Cloud, Loader2, Save, Check } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/core/sdk/admin";
import { errorMessage } from "@/core/sdk";

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
        let cancelled = false;
        fetch("/api/v1/storage/cloudflare-r2/settings")
            .then((r) => r.json())
            .then((d) => {
                if (cancelled) return;
                if (d.config) setConfig(d.config);
                setIsActive(!!d.isActive);
                setSetActive(!!d.isActive);
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
            const res = await fetch("/api/v1/storage/cloudflare-r2/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...config, setActive }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(errorMessage(data, t("saveError"), t));
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
            <AdminPageHeader
                title={<span className="inline-flex items-center gap-2"><Cloud className="w-6 h-6 text-warning" />{t("title")}</span>}
                description={t("subtitle")}
                actions={isActive ? (
                    <Badge tone="success"><Check className="w-3.5 h-3.5" />{t("currentlyActive")}</Badge>
                ) : undefined}
            />

            <Card>
                <CardHeader>
                    <CardTitle>{t("title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label>{t("accountId")}</Label>
                        <Input
                            aria-label={t("accountId")}
                            value={config.accountId}
                            onChange={(e) => setConfig({ ...config, accountId: e.target.value })}
                            placeholder="abc123def456..."
                        />
                    </div>
                    <div>
                        <Label>{t("bucket")}</Label>
                        <Input
                            aria-label={t("bucket")}
                            value={config.bucket}
                            onChange={(e) => setConfig({ ...config, bucket: e.target.value })}
                            placeholder="my-bucket"
                        />
                    </div>
                    <div>
                        <Label>{t("accessKey")}</Label>
                        <Input
                            aria-label={t("accessKey")}
                            value={config.accessKey}
                            onChange={(e) => setConfig({ ...config, accessKey: e.target.value })}
                            placeholder="..."
                        />
                    </div>
                    <div>
                        <Label>{t("secretKey")}</Label>
                        <Input
                            aria-label={t("secretKey")}
                            type="password"
                            value={config.secretKey}
                            onChange={(e) => setConfig({ ...config, secretKey: e.target.value })}
                            placeholder="..."
                        />
                    </div>
                    <div>
                        <Label>{t("publicUrl")}</Label>
                        <Input
                            aria-label={t("publicUrl")}
                            value={config.publicUrl}
                            onChange={(e) => setConfig({ ...config, publicUrl: e.target.value })}
                            placeholder="https://pub-xxx.r2.dev"
                        />
                        <p className="text-xs text-muted-foreground mt-1">{t("publicUrlHint")}</p>
                    </div>
                    <CheckboxField
                        checked={setActive}
                        onChange={(e) => setSetActive(e.target.checked)}
                        label={t("active")}
                    />
                    <Button onClick={save} disabled={saving} className="w-full">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? t("saving") : t("save")}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
