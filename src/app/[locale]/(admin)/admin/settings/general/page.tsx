"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/core/components/admin/AdminPageHeader";
import { LoadFailed } from "@/core/components/ui/load-failed";
import { useSettingsLoad } from "@/core/hooks/useSettingsLoad";

interface FieldDef {
    key: string;
    labelKey: string;
    type: "number";
    defaultValue: number;
    descriptionKey?: string;
}

interface SectionDef {
    titleKey: string;
    fields: FieldDef[];
}

const sections: SectionDef[] = [
    {
        titleKey: "generalSettings_authSecurity",
        fields: [
            { key: "password_min_length", labelKey: "generalSettings_minPasswordLength", type: "number", defaultValue: 10, descriptionKey: "generalSettings_minPasswordLengthHint" },
            { key: "email_verify_expiry_hours", labelKey: "generalSettings_emailVerifyExpiry", type: "number", defaultValue: 24 },
            { key: "password_reset_expiry_minutes", labelKey: "generalSettings_passwordResetExpiry", type: "number", defaultValue: 60 },
        ],
    },
    {
        titleKey: "generalSettings_cachePerformance",
        fields: [
            { key: "settings_cache_seconds", labelKey: "generalSettings_cacheSeconds", type: "number", defaultValue: 60 },
        ],
    },
];

const allFields = sections.flatMap((s) => s.fields);

export default function GeneralSettingsPage() {
    const t = useTranslations("admin");
    const [saving, setSaving] = useState(false);
    const [values, setValues] = useState<Record<string, string>>({});

    // Every field falls back to its default, so a failed read renders a form
    // full of defaults that saving would write over the real settings.
    const { loading, failed, retry } = useSettingsLoad((s) => {
        const v: Record<string, string> = {};
        for (const field of allFields) {
            v[field.key] = s[field.key] !== undefined && s[field.key] !== null
                ? String(s[field.key])
                : String(field.defaultValue);
        }
        setValues(v);
    });

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

    if (failed) {
        return (
            <>
                <AdminPageHeader title={t("generalSettings_title")} description={t("generalSettings_subtitle")} />
                <Card><CardContent><LoadFailed onRetry={retry} /></CardContent></Card>
            </>
        );
    }

    return (
        <>
            <AdminPageHeader
                title={t("generalSettings_title")}
                description={t("generalSettings_subtitle")}
            />

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
                                            aria-label={t(field.labelKey)}
                                            type="number"
                                            value={values[field.key] as string}
                                            onChange={(e) => setValue(field.key, e.target.value)}
                                            placeholder={String(field.defaultValue)}
                                            min={0}
                                        />
                                        {field.descriptionKey && (
                                            <p className="text-xs text-muted-foreground mt-1">{t(field.descriptionKey)}</p>
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
                            <><Loader2 className="w-4 h-4 animate-spin" /> {t("generalSettings_saving")}</>
                        ) : (
                            <><Check className="w-4 h-4" /> {t("generalSettings_saveSettings")}</>
                        )}
                    </Button>
                </div>
            </form>
        </>
    );
}
