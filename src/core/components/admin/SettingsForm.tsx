"use client";

import { useState } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { FileUpload } from "@/core/components/ui/file-upload";
import { IconPicker } from "@/core/components/ui/icon-picker";
import { Loader2, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { NativeSelect } from "@/core/components/ui/native-select";
import { LoadFailed } from "@/core/components/ui/load-failed";
import { useSettingsLoad } from "@/core/hooks/useSettingsLoad";
import { AdminPageHeader } from "@/core/components/admin/AdminPageHeader";
import { Textarea } from "@/core/components/ui/textarea";

export interface SettingsField {
    key: string;
    label: string;
    /** "icon" renders the Lucide icon picker and stores the icon's kebab-case name. */
    type?: "text" | "password" | "number" | "url" | "email" | "textarea" | "image" | "select" | "date" | "icon";
    placeholder?: string;
    description?: string;
    defaultValue?: string;
    accept?: string;
    options?: { value: string; label: string }[];
}

interface SettingsFormProps {
    title: string;
    subtitle: string;
    fields: SettingsField[];
    children?: React.ReactNode;
}

/** The header's submit button points at the form by id; they are the same form. */
const FORM_ID = "settings-form";

export function SettingsForm({ title, subtitle, fields, children }: SettingsFormProps) {
    const t = useTranslations("admin");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [values, setValues] = useState<Record<string, string>>({});

    // Shared by every screen built out of this form, so the hole was shared
    // too: a failed read rendered the defaults and the save button under them
    // wrote the defaults back.
    const { loading, failed, retry } = useSettingsLoad((s) => {
        const v: Record<string, string> = {};
        for (const field of fields) {
            v[field.key] = (s[field.key] as string) || field.defaultValue || "";
        }
        setValues(v);
    });

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

    if (failed) {
        return (
            <>
                <AdminPageHeader title={title} description={subtitle} />
                <Card><CardContent><LoadFailed onRetry={retry} /></CardContent></Card>
            </>
        );
    }

    return (
        <>
            {/* The save lives in the header rather than under the card. On a
                settings screen the page *is* the form, so its save is a
                page-level action and belongs with the rest of them; left at
                the bottom it sat in a different place on every screen,
                depending only on how many fields that screen happened to
                have. `form` is what lets a submit button stand outside the
                form it submits. */}
            <AdminPageHeader
                title={title}
                description={subtitle}
                actions={
                    <Button type="submit" form={FORM_ID} disabled={saving}>
                        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("settingsForm_saving")}</> :
                         saved ? <><Check className="w-4 h-4" /> {t("settingsForm_saved")}</> : t("settingsForm_saveSettings")}
                    </Button>
                }
            />

            {error && <div role="alert" className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>}

            <form id={FORM_ID} onSubmit={handleSave}>
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {fields.map((field) => (
                            <div key={field.key}>
                                <Label>{field.label}</Label>
                                {field.type === "textarea" ? (
                                    <Textarea
                                        aria-label={field.label}
                                        value={values[field.key] || ""}
                                        onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                                        placeholder={field.placeholder}
                                        rows={3}
                                    />
                                ) : field.type === "image" ? (
                                    <FileUpload
                                        value={values[field.key] || null}
                                        onChange={(v) => setValues({ ...values, [field.key]: v || "" })}
                                        accept={field.accept || "image/*"}
                                    />
                                ) : field.type === "icon" ? (
                                    <IconPicker
                                        value={values[field.key] || ""}
                                        onChange={(v) => setValues({ ...values, [field.key]: v })}
                                        placeholder={field.placeholder}
                                    />
                                ) : field.type === "select" ? (
                                    <NativeSelect
                                        value={values[field.key] || ""}
                                        onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                                        aria-label={field.label} className="w-full" inputSize="sm"
                                    >
                                        {field.placeholder && !values[field.key] && (
                                            <option value="">{field.placeholder}</option>
                                        )}
                                        {(field.options || []).map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </NativeSelect>
                                ) : (
                                    <Input
                                        type={field.type || "text"}
                                        value={values[field.key] || ""}
                                        onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                                        placeholder={field.placeholder} aria-label={field.label}
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
            </form>
        </>
    );
}
