"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import * as Fields from "@/core/components/admin/theme-customizer/fields";
import type { ThemeFieldDef } from "@/core/lib/theme-manifest-schema";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent } from "@/core/components/ui/card";
import { Check, Loader2 } from "lucide-react";

interface Props {
    themeId: string;
    group: string;
    fields: Record<string, ThemeFieldDef>;
    initialValues: Record<string, unknown>;
}

export function SchemaForm({ themeId, group, fields, initialValues }: Props) {
    const t = useTranslations("admin");
    const commonT = useTranslations("common");
    const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...initialValues }));
    const [saving, setSaving] = useState(false);

    const set = (key: string, v: unknown) => setValues(prev => ({ ...prev, [key]: v }));

    const onSubmit = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/v1/themes/${themeId}/settings/${group}`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ values }),
            });
            if (!res.ok) { toast.error(t("theme_saveFailed")); return; }
            toast.success(t("theme_saved"));
        } catch {
            toast.error(t("theme_saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {/* A theme group is a form, and a form on a wide panel is not a
                narrow column with a button under it. The fields sit two or
                three across, and the save button sits where every other
                screen's does. */}
            <div className="mb-6 flex justify-end">
                <Button onClick={onSubmit} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? t("theme_saving") : commonT("save")}
                </Button>
            </div>

            <Card>
                <CardContent className="grid gap-6 p-6 md:grid-cols-2 xl:grid-cols-3">
                    {Object.entries(fields).map(([key, def]) => (
                        <FieldRow key={key} fieldKey={key} def={def} value={values[key]} onChange={(v) => set(key, v)} />
                    ))}
                </CardContent>
            </Card>
        </>
    );
}

function FieldRow({ fieldKey, def, value, onChange }: { fieldKey: string; def: ThemeFieldDef; value: unknown; onChange: (v: unknown) => void }) {
    const isDefault = value === undefined;
    // ColorField renders its own label inline (color swatch + label side by
    // side); every other field component only renders the input, so we
    // stack a label header above.
    const label = def.label ?? fieldKey;
    const inner = renderField(def, value, onChange, isDefault);
    // Some fields are too big for a column: an editor or an image picker
    // squeezed into a third of the row is unusable.
    const wide = def.type === "richtext" || def.type === "image";
    if (def.type === "color") return inner;
    return (
        <div className={`space-y-1.5${wide ? " md:col-span-2 xl:col-span-3" : ""}`}>
            <div className="text-sm font-medium">{label}</div>
            {inner}
        </div>
    );
}

function renderField(def: ThemeFieldDef, value: unknown, onChange: (v: unknown) => void, isDefault: boolean) {
    switch (def.type) {
        case "color":    return <Fields.ColorField def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "font":     return <Fields.FontField  def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "select":   return <Fields.SelectField def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "slider":   return <Fields.SliderField def={def} value={value as number} onChange={onChange as (v: number | undefined) => void} isDefault={isDefault} />;
        case "toggle":   return <Fields.ToggleField def={def} value={value as boolean} onChange={onChange as (v: boolean | undefined) => void} isDefault={isDefault} />;
        case "text":     return <Fields.TextField   def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "url":      return <Fields.UrlField    def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "richtext": return <Fields.RichTextField def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "image":    return <Fields.ImageField  def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "number":   return <Fields.SliderField def={{ type: "slider", min: (def as { min?: number }).min ?? 0, max: (def as { max?: number }).max ?? 100, label: def.label, default: (def as { default?: number }).default }} value={value as number} onChange={onChange as (v: number | undefined) => void} isDefault={isDefault} />;
    }
}
