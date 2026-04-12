"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface FieldDef {
    key: string;
    labelKey: string;
    type: "number";
    defaultValue: number;
    description?: string;
}

interface SectionDef {
    titleKey: string;
    fields: FieldDef[];
}

const sections: SectionDef[] = [
    {
        titleKey: "generalSettings_authSecurity",
        fields: [
            { key: "password_min_length", labelKey: "generalSettings_minPasswordLength", type: "number", defaultValue: 6 },
            { key: "email_verify_expiry_hours", labelKey: "generalSettings_emailVerifyExpiry", type: "number", defaultValue: 24 },
            { key: "password_reset_expiry_minutes", labelKey: "generalSettings_passwordResetExpiry", type: "number", defaultValue: 60 },
        ],
    },
    {
        titleKey: "generalSettings_cachePerformance",
        fields: [
            { key: "settings_cache_seconds", labelKey: "generalSettings_cacheSeconds", type: "number", defaultValue: 60 },
            { key: "widget_refresh_seconds", labelKey: "generalSettings_widgetRefresh", type: "number", defaultValue: 30 },
        ],
    },
];

const allFields = sections.flatMap((s) => s.fields);

export default function GeneralSettingsPage() {
    const t = useTranslations("admin");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [values, setValues] = useState<Record<string, string>>({});

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((data) => {
                const s = data.settings || {};
                const v: Record<string, string> = {};
                for (const field of allFields) {
                    v[field.key] = s[field.key] !== undefined && s[field.key] !== null
                        ? String(s[field.key])
                        : String(field.defaultValue);
                }
                setValues(v);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const setValue = (key: string, val: string) => {
        setValues((prev) => ({ ...prev, [key]: val }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const res = await fetch("/api/v1/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });

            if (!res.ok) {
                toast.error(t("generalSettings_saveFailed"));
                return;
            }

            toast.success(t("generalSettings_saved"));
        } catch {
            toast.error(t("generalSettings_saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <>
            <div className="mb-8">
                <h1 className="text-xl font-semibold">{t("generalSettings_title")}</h1>
                <p className="text-muted-foreground">{t("generalSettings_subtitle")}</p>
            </div>

            <form onSubmit={handleSave}>
                <div className="grid lg:grid-cols-2 gap-6">
                    {sections.map((section) => (
                        <Card key={section.titleKey}>
                            <CardHeader>
                                <CardTitle>{t(section.titleKey)}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {section.fields.map((field) => (
                                    <div key={field.key}>
                                        <Label>{t(field.labelKey)}</Label>
                                        <Input
                                            type="number"
                                            value={values[field.key] as string}
                                            onChange={(e) => setValue(field.key, e.target.value)}
                                            placeholder={String(field.defaultValue)}
                                            min={0}
                                        />
                                        {field.description && (
                                            <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="mt-6">
                    <Button type="submit" disabled={saving}>
                        {saving ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("generalSettings_saving")}</>
                        ) : (
                            <><Check className="w-4 h-4 mr-2" /> {t("generalSettings_saveSettings")}</>
                        )}
                    </Button>
                </div>
            </form>
        </>
    );
}
