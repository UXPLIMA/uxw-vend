"use client";

import { useEffect, useState } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type ModerationMode = "auto" | "manual";

interface ModerationField {
    settingKey: string;
    label: string;
    labelKey?: string;
    descKey?: string;
}

export default function ModerationSettingsPage() {
    const t = useTranslations("admin");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fields, setFields] = useState<ModerationField[]>([]);
    const [config, setConfig] = useState<Record<string, ModerationMode>>({});

    useEffect(() => {
        Promise.all([
            fetch("/api/v1/admin/moderation").then((r) => (r.ok ? r.json() : null)),
            fetch("/api/v1/settings").then((r) => (r.ok ? r.json() : null)),
        ])
            .then(([modPayload, settingsPayload]) => {
                const types = (modPayload?.types ?? {}) as Record<
                    string,
                    { label: string; settingKey?: string; settingLabelKey?: string; settingDescKey?: string }
                >;
                const builtFields: ModerationField[] = [];
                for (const meta of Object.values(types)) {
                    if (!meta.settingKey) continue;
                    builtFields.push({
                        settingKey: meta.settingKey,
                        label: meta.label,
                        labelKey: meta.settingLabelKey,
                        descKey: meta.settingDescKey,
                    });
                }
                setFields(builtFields);

                const stored = (settingsPayload?.settings?.moderation ?? {}) as Record<string, unknown>;
                const next: Record<string, ModerationMode> = {};
                for (const f of builtFields) {
                    next[f.settingKey] = stored[f.settingKey] === "manual" ? "manual" : "auto";
                }
                setConfig(next);
            })
            .catch(() => {
                toast.error(t("moderationSettings_loadFailed"));
            })
            .finally(() => setLoading(false));
    }, [t]);

    const toggleField = (key: string) => {
        setConfig((prev) => ({
            ...prev,
            [key]: prev[key] === "manual" ? "auto" : "manual",
        }));
    };

    const onSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/v1/settings", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ moderation: config }),
            });
            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                toast.error(data?.error || t("moderationSettings_saveFailed"));
                return;
            }
            toast.success(t("moderationSettings_saved"));
        } catch {
            toast.error(t("moderationSettings_saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">
                    {t("moderationSettings_title")}
                </h1>
                <p className="text-muted-foreground">
                    {t("moderationSettings_subtitle")}
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t("moderationSettings_approvalRequired")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {fields.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t("moderationSettings_noProviders")}
                        </p>
                    ) : (
                        fields.map((field) => (
                            <label
                                key={field.settingKey}
                                className="flex items-start gap-3 cursor-pointer border rounded-md p-3 hover:bg-accent/40"
                            >
                                <input
                                    type="checkbox"
                                    checked={config[field.settingKey] === "manual"}
                                    onChange={() => toggleField(field.settingKey)}
                                    className="w-4 h-4 mt-1"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">
                                        {field.labelKey && t.has(field.labelKey) ? t(field.labelKey) : field.label}
                                    </p>
                                    {field.descKey && t.has(field.descKey) && (
                                        <p className="text-xs text-muted-foreground">{t(field.descKey)}</p>
                                    )}
                                </div>
                                <span
                                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${config[field.settingKey] === "manual"
                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                        : "bg-muted text-muted-foreground"
                                        }`}
                                >
                                    {config[field.settingKey]}
                                </span>
                            </label>
                        ))
                    )}
                </CardContent>
            </Card>

            <div className="flex items-center justify-between">
                <Link
                    href="/admin/moderation"
                    className="text-sm text-primary hover:underline"
                >
                    {t("moderationSettings_openQueue")}
                </Link>
                <Button onClick={onSave} disabled={saving}>
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("moderationSettings_saving")}
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" /> {t("moderationSettings_saveChanges")}
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
