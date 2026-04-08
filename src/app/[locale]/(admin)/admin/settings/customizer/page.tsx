"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { ArrowLeft, Loader2, Check, RotateCcw, Palette } from "lucide-react";
import { toast } from "sonner";
import { themeRegistry } from "@/core/generated/theme-registry";
import type { ThemeProperty, ThemeOverrides } from "@/core/types/theme";
import { invalidateSettingsCache } from "@/core/hooks/useSiteSettings";

function getNestedValue(obj: unknown, path: string): string {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const p of parts) {
        if (typeof current !== "object" || current === null) return "";
        current = (current as Record<string, unknown>)[p];
    }
    return typeof current === "string" ? current : "";
}

export default function ThemeCustomizerPage() {
    const [activeThemeId, setActiveThemeId] = useState<string>("flat");
    const [overrides, setOverrides] = useState<Record<string, string>>({});
    const [allOverrides, setAllOverrides] = useState<ThemeOverrides>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Load settings on mount
    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((data) => {
                const s = data.settings || {};
                const themeId = (s.active_theme as string) || "flat";
                setActiveThemeId(themeId);
                const stored = (s.theme_overrides as ThemeOverrides) || {};
                setAllOverrides(stored);
                setOverrides(stored[themeId] || {});
            })
            .finally(() => setLoading(false));
    }, []);

    const theme = themeRegistry[activeThemeId];
    const schema = theme?.config.schema || [];

    // Group properties by their `group` field
    const grouped = useMemo(() => {
        const groups: Record<string, ThemeProperty[]> = {};
        for (const prop of schema) {
            const g = prop.group || "Other";
            if (!groups[g]) groups[g] = [];
            groups[g].push(prop);
        }
        return groups;
    }, [schema]);

    const getValue = (prop: ThemeProperty): string => {
        if (overrides[prop.key] !== undefined) return overrides[prop.key];
        if (!theme) return "";
        return getNestedValue(theme.config, prop.key);
    };

    const setValue = (key: string, value: string) => {
        setOverrides({ ...overrides, [key]: value });
    };

    const resetProperty = (key: string) => {
        const next = { ...overrides };
        delete next[key];
        setOverrides(next);
    };

    const resetAll = () => {
        setOverrides({});
    };

    const save = async () => {
        setSaving(true);
        setSaved(false);
        try {
            // Remove empty/undefined keys to keep the stored object clean
            const clean: Record<string, string> = {};
            for (const [k, v] of Object.entries(overrides)) {
                if (v && v !== "") clean[k] = v;
            }
            const nextAll = { ...allOverrides, [activeThemeId]: clean };
            if (Object.keys(clean).length === 0) {
                delete nextAll[activeThemeId];
            }

            const res = await fetch("/api/v1/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ theme_overrides: nextAll }),
            });
            if (!res.ok) {
                toast.error("Failed to save");
                return;
            }
            setAllOverrides(nextAll);
            invalidateSettingsCache();
            setSaved(true);
            toast.success("Theme updated");
            setTimeout(() => setSaved(false), 3000);
        } catch {
            toast.error("Something went wrong");
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

    if (!theme) {
        return <p>Theme not found: {activeThemeId}</p>;
    }

    if (schema.length === 0) {
        return (
            <>
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/admin/settings"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
                    <div>
                        <h1 className="text-3xl font-bold">Theme Customizer</h1>
                        <p className="text-muted-foreground">Customize theme colors, fonts, and layout</p>
                    </div>
                </div>
                <Card><CardContent className="py-8 text-center text-muted-foreground">
                    The active theme <strong>{theme.config.name}</strong> does not expose any editable properties.
                </CardContent></Card>
            </>
        );
    }

    return (
        <>
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/settings"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Palette className="w-7 h-7" />
                        Theme Customizer
                    </h1>
                    <p className="text-muted-foreground">Active theme: {theme.config.name}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={resetAll} disabled={Object.keys(overrides).length === 0}>
                        <RotateCcw className="w-4 h-4 mr-2" /> Reset all
                    </Button>
                    <Button onClick={save} disabled={saving}>
                        {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…</> :
                         saved ? <><Check className="w-4 h-4 mr-2" /> Saved</> : "Save Theme"}
                    </Button>
                </div>
            </div>

            <div className="space-y-6">
                {Object.entries(grouped).map(([groupName, props]) => (
                    <Card key={groupName}>
                        <CardHeader>
                            <CardTitle>{groupName}</CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4">
                            {props.map((prop) => {
                                const val = getValue(prop);
                                const isOverridden = overrides[prop.key] !== undefined;
                                return (
                                    <div key={prop.key} className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm">{prop.label}</Label>
                                            {isOverridden && (
                                                <button
                                                    type="button"
                                                    onClick={() => resetProperty(prop.key)}
                                                    className="text-xs text-muted-foreground hover:text-foreground"
                                                    title="Reset to default"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                        {prop.type === "color" ? (
                                            <div className="flex gap-2">
                                                <input
                                                    type="color"
                                                    value={val || "#000000"}
                                                    onChange={(e) => setValue(prop.key, e.target.value)}
                                                    className="w-10 h-10 rounded cursor-pointer border border-border"
                                                />
                                                <Input
                                                    value={val}
                                                    onChange={(e) => setValue(prop.key, e.target.value)}
                                                    placeholder={prop.description}
                                                />
                                            </div>
                                        ) : prop.type === "slider" ? (
                                            <input
                                                type="range"
                                                value={val}
                                                min={prop.min}
                                                max={prop.max}
                                                step={prop.step}
                                                onChange={(e) => setValue(prop.key, e.target.value)}
                                                className="w-full"
                                            />
                                        ) : prop.type === "select" ? (
                                            <select
                                                value={val}
                                                onChange={(e) => setValue(prop.key, e.target.value)}
                                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            >
                                                {prop.options?.map((o) => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Input
                                                type={prop.type === "number" ? "number" : "text"}
                                                value={val}
                                                onChange={(e) => setValue(prop.key, e.target.value)}
                                                placeholder={prop.description}
                                            />
                                        )}
                                        {prop.description && (
                                            <p className="text-xs text-muted-foreground">{prop.description}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </>
    );
}
