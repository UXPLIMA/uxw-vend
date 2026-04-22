"use client";

import { useMemo, useState } from "react";
import type { ThemeManifest, ThemeFieldDef, ThemeSettingsGroup } from "@/core/lib/theme-manifest-schema";
import { computeOverrideDiff, applyOverrides } from "./diff";
import * as Fields from "./fields";

function Field({
    def,
    value,
    onChange,
    isDefault,
}: {
    def: ThemeFieldDef;
    value: unknown;
    onChange: (v: unknown) => void;
    isDefault: boolean;
}) {
    switch (def.type) {
        case "color":
            return (
                <Fields.ColorField
                    def={def}
                    value={value as string}
                    onChange={onChange as (v: string | undefined) => void}
                    isDefault={isDefault}
                />
            );
        case "font":
            return (
                <Fields.FontField
                    def={def}
                    value={value as string}
                    onChange={onChange as (v: string | undefined) => void}
                    isDefault={isDefault}
                />
            );
        case "select":
            return (
                <Fields.SelectField
                    def={def}
                    value={value as string}
                    onChange={onChange as (v: string | undefined) => void}
                    isDefault={isDefault}
                />
            );
        case "slider":
            return (
                <Fields.SliderField
                    def={def}
                    value={value as number}
                    onChange={onChange as (v: number | undefined) => void}
                    isDefault={isDefault}
                />
            );
        case "toggle":
            return (
                <Fields.ToggleField
                    def={def}
                    value={value as boolean}
                    onChange={onChange as (v: boolean | undefined) => void}
                    isDefault={isDefault}
                />
            );
        case "text":
            return (
                <Fields.TextField
                    def={def}
                    value={value as string}
                    onChange={onChange as (v: string | undefined) => void}
                    isDefault={isDefault}
                />
            );
        case "url":
            return (
                <Fields.UrlField
                    def={def}
                    value={value as string}
                    onChange={onChange as (v: string | undefined) => void}
                    isDefault={isDefault}
                />
            );
        case "richtext":
            return (
                <Fields.RichTextField
                    def={def}
                    value={value as string}
                    onChange={onChange as (v: string | undefined) => void}
                    isDefault={isDefault}
                />
            );
        case "image":
            return (
                <Fields.ImageField
                    def={def}
                    value={value as string}
                    onChange={onChange as (v: string | undefined) => void}
                    isDefault={isDefault}
                />
            );
    }
}

export function CustomizerForm({
    manifest,
    initialOverrides,
    onPreview,
    onSave,
}: {
    manifest: ThemeManifest;
    initialOverrides: Record<string, unknown>;
    onPreview: (diff: Record<string, unknown>) => void;
    onSave: (diff: Record<string, unknown>) => Promise<void>;
}) {
    const defaults = useMemo(() => {
        const d: Record<string, unknown> = {};
        for (const [g, gd] of Object.entries(manifest.settings ?? {}) as [string, ThemeSettingsGroup][]) {
            d[g] = {};
            for (const [f, def] of Object.entries(gd.fields) as [string, ThemeFieldDef][]) {
                if ("default" in def && def.default !== undefined) {
                    (d[g] as Record<string, unknown>)[f] = def.default;
                }
            }
        }
        return d;
    }, [manifest]);

    const [current, setCurrent] = useState<Record<string, unknown>>(() =>
        applyOverrides(defaults, initialOverrides),
    );
    const [saving, setSaving] = useState(false);

    function patch(group: string, field: string, value: unknown) {
        setCurrent((prev) => {
            const next = {
                ...prev,
                [group]: {
                    ...((prev[group] as Record<string, unknown> | undefined) ?? {}),
                    [field]: value,
                },
            };
            onPreview(computeOverrideDiff(defaults, next));
            return next;
        });
    }

    async function save() {
        setSaving(true);
        try {
            await onSave(computeOverrideDiff(defaults, current));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {(Object.entries(manifest.settings ?? {}) as [string, ThemeSettingsGroup][]).map(([group, gd]) => (
                <section key={group} className="rounded border p-3">
                    <h3 className="mb-2 font-medium">{gd.label}</h3>
                    <div className="flex flex-col gap-3">
                        {(Object.entries(gd.fields) as [string, ThemeFieldDef][]).map(([field, def]) => {
                            const v = (current[group] as Record<string, unknown> | undefined)?.[field];
                            const isDefault = def.default === v || v === undefined;
                            return (
                                <div key={field}>
                                    <div className="mb-1 text-sm text-muted-foreground">
                                        {def.label ?? field}
                                    </div>
                                    <Field
                                        def={def}
                                        value={v}
                                        onChange={(nv) => patch(group, field, nv)}
                                        isDefault={isDefault}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}
            <button
                type="button"
                disabled={saving}
                onClick={save}
                className="rounded bg-primary px-4 py-2 text-white"
            >
                {saving ? "Saving…" : "Save"}
            </button>
        </div>
    );
}
