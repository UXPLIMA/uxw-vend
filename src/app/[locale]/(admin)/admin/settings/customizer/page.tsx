"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { ArrowLeft, Loader2, Check, RotateCcw, Palette, Monitor, Smartphone, Tablet } from "lucide-react";
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
    const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
    const [previewReady, setPreviewReady] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Listen for the iframe's "preview-ready" handshake
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === "uxwvend:preview-ready") {
                setPreviewReady(true);
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, []);

    // Push current overrides to the iframe whenever they change
    useEffect(() => {
        if (!previewReady) return;
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;
        iframe.contentWindow.postMessage(
            { type: "uxwvend:theme-preview", overrides },
            "*"
        );
    }, [overrides, previewReady]);

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

    const deviceWidth = device === "desktop" ? "100%" : device === "tablet" ? "768px" : "375px";

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)]">
            {/* Top toolbar */}
            <div className="flex items-center gap-4 mb-4 flex-shrink-0">
                <Link href="/admin/settings"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Palette className="w-6 h-6" />
                        Theme Customizer
                    </h1>
                    <p className="text-xs text-muted-foreground">Active theme: {theme.config.name}</p>
                </div>
                {/* Device toggle */}
                <div className="flex gap-1 bg-muted rounded-md p-1">
                    <button
                        type="button"
                        onClick={() => setDevice("desktop")}
                        className={`p-1.5 rounded ${device === "desktop" ? "bg-card shadow-sm" : ""}`}
                        title="Desktop"
                    >
                        <Monitor className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setDevice("tablet")}
                        className={`p-1.5 rounded ${device === "tablet" ? "bg-card shadow-sm" : ""}`}
                        title="Tablet"
                    >
                        <Tablet className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setDevice("mobile")}
                        className={`p-1.5 rounded ${device === "mobile" ? "bg-card shadow-sm" : ""}`}
                        title="Mobile"
                    >
                        <Smartphone className="w-4 h-4" />
                    </button>
                </div>
                <Button variant="outline" size="sm" onClick={resetAll} disabled={Object.keys(overrides).length === 0}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Reset all
                </Button>
                <Button onClick={save} disabled={saving} size="sm">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…</> :
                     saved ? <><Check className="w-4 h-4 mr-2" /> Saved</> : "Save Theme"}
                </Button>
            </div>

            {/* Split layout: form left, preview right */}
            <div className="flex gap-4 flex-1 min-h-0">
                {/* Left: form (scrollable) */}
                <div className="w-96 overflow-y-auto pr-2 space-y-4 flex-shrink-0">
                    {Object.entries(grouped).map(([groupName, props]) => (
                        <Card key={groupName}>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">{groupName}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {props.map((prop) => {
                                    const val = getValue(prop);
                                    const isOverridden = overrides[prop.key] !== undefined;
                                    return (
                                        <div key={prop.key} className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs">{prop.label}</Label>
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
                                                        className="w-9 h-9 rounded cursor-pointer border border-border flex-shrink-0"
                                                    />
                                                    <Input
                                                        value={val}
                                                        onChange={(e) => setValue(prop.key, e.target.value)}
                                                        placeholder={prop.description}
                                                        className="text-xs h-9"
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
                                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
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
                                                    className="text-xs h-9"
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Right: live preview iframe */}
                <div className="flex-1 bg-muted rounded-lg overflow-hidden flex items-start justify-center p-4">
                    <iframe
                        ref={iframeRef}
                        src="/"
                        title="Live preview"
                        className="bg-card rounded shadow-lg border border-border"
                        style={{
                            width: deviceWidth,
                            height: "100%",
                            transition: "width 0.2s ease",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
