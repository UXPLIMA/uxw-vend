"use client";

import { useState, useEffect } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { FileUpload } from "@/core/components/ui/file-upload";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { useTranslations } from "next-intl";

export interface SettingsField {
    key: string;
    label: string;
    type?: "text" | "password" | "number" | "url" | "email" | "textarea" | "image";
    placeholder?: string;
    description?: string;
    defaultValue?: string;
    accept?: string;
}

interface SettingsFormProps {
    title: string;
    subtitle: string;
    fields: SettingsField[];
    children?: React.ReactNode;
}

export function SettingsForm({ title, subtitle, fields, children }: SettingsFormProps) {
    const t = useTranslations("admin");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [values, setValues] = useState<Record<string, string>>({});

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((data) => {
                const s = data.settings || {};
                const v: Record<string, string> = {};
                for (const field of fields) {
                    v[field.key] = (s[field.key] as string) || field.defaultValue || "";
                }
                setValues(v);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSaved(false);

        try {
            const res = await fetch("/api/v1/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            if (!res.ok) { setError(t("settingsForm_failedToSave")); return; }
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            setError(t("settingsForm_somethingWrong"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <>
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/settings">
                    <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">{title}</h1>
                    <p className="text-muted-foreground">{subtitle}</p>
                </div>
            </div>

            {error && <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>}

            <form onSubmit={handleSave}>
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {fields.map((field) => (
                            <div key={field.key}>
                                <Label>{field.label}</Label>
                                {field.type === "textarea" ? (
                                    <textarea
                                        value={values[field.key] || ""}
                                        onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                                        placeholder={field.placeholder}
                                        rows={3}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    />
                                ) : field.type === "image" ? (
                                    <FileUpload
                                        value={values[field.key] || null}
                                        onChange={(v) => setValues({ ...values, [field.key]: v || "" })}
                                        accept={field.accept || "image/*"}
                                    />
                                ) : (
                                    <Input
                                        type={field.type || "text"}
                                        value={values[field.key] || ""}
                                        onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                                        placeholder={field.placeholder}
                                    />
                                )}
                                {field.description && (
                                    <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {children}

                <div className="mt-6">
                    <Button type="submit" disabled={saving}>
                        {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("settingsForm_saving")}</> :
                         saved ? <><Check className="w-4 h-4 mr-2" /> {t("settingsForm_saved")}</> : t("settingsForm_saveSettings")}
                    </Button>
                </div>
            </form>
        </>
    );
}
