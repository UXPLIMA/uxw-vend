"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTheme as useNextTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Check, Upload, Loader2, Trash2, AlertTriangle, Palette, Download, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

import { themeRegistry } from "@/core/generated/theme-registry";

export default function ThemeSettingsPage() {
    const t = useTranslations("admin");
    const { setTheme, theme: currentThemeId } = useNextTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const { confirm } = useConfirm();

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadMessage(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/v1/themes/upload", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                const errorMsg = data.details
                    ? `${data.error}: ${data.details.join(", ")}`
                    : data.error;
                setUploadMessage({ type: "error", text: errorMsg });
                return;
            }

            setUploadMessage({ type: "success", text: data.message });
        } catch {
            setUploadMessage({ type: "error", text: "Upload failed" });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDelete = async (themeId: string) => {
        const ok = await confirm({ title: "Delete Theme", message: `Delete theme "${themeId}"? This cannot be undone.`, variant: "danger", confirmText: "Delete" });
        if (!ok) return;

        setDeleting(themeId);
        try {
            const res = await fetch(`/api/v1/themes/${themeId}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || t("theme_deleteFailed"));
            } else {
                setUploadMessage({ type: "success", text: data.message });
            }
        } catch {
            toast.error(t("theme_deleteFailed"));
        } finally {
            setDeleting(null);
        }
    };

    const renderPreview = (themeId: string) => {
        // TODO(T15/T18): rewrite against new ThemeManifest shape (tokens.colors[name].default)
        const theme = themeRegistry[themeId] as unknown as { config: { colors: Record<string, string>; fonts?: Record<string, string>; schema?: unknown } } | undefined;
        if (!theme) return null;

        const { colors } = theme.config;

        return (
            <div className="w-full h-32 rounded-md mb-4 relative overflow-hidden border border-border" style={{ background: colors.background }}>
                <div className="absolute top-0 left-0 w-full h-8 border-b flex items-center px-2 space-x-2" style={{ borderColor: colors.border, background: colors.muted }}>
                    <div className="w-3 h-3 rounded-full" style={{ background: colors.destructive }} />
                    <div className="w-3 h-3 rounded-full" style={{ background: colors.warning }} />
                    <div className="w-3 h-3 rounded-full" style={{ background: colors.success }} />
                </div>
                <div className="p-4 mt-8 space-y-2">
                    <div className="h-4 w-3/4 rounded" style={{ background: colors.primary, opacity: 0.2 }} />
                    <div className="h-4 w-1/2 rounded" style={{ background: colors.primary, opacity: 0.1 }} />
                    <div className="flex space-x-2 mt-4">
                        <div className="h-8 px-4 rounded flex items-center text-xs font-bold" style={{ background: colors.primary, color: '#fff' }}>
                            Action
                        </div>
                        <div className="h-8 px-4 rounded flex items-center text-xs font-bold" style={{ background: colors.secondary, color: '#fff' }}>
                            Sec
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const builtInThemes = ["flat"];

    // Marketplace
    const [marketplaceThemes, setMarketplaceThemes] = useState<{ id: string; name: string; version: string; type: string; description: string; verified: boolean; zip: string; colors?: Record<string, string> }[]>([]);
    const [loadingMarketplace, setLoadingMarketplace] = useState(true);
    const [installing, setInstalling] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/v1/themes/marketplace")
            .then(r => r.json())
            .then(d => { setMarketplaceThemes(d.themes || []); setLoadingMarketplace(false); })
            .catch(() => setLoadingMarketplace(false));
    }, []);

    const installedThemeIds = new Set(Object.keys(themeRegistry));

    const handleMarketplaceInstall = async (theme: { id: string; name: string; zip: string }) => {
        setInstalling(theme.id);
        try {
            const res = await fetch("/api/v1/themes/marketplace/install", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ themeId: theme.id, zipFile: theme.zip }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`"${theme.name}" installed. Restart server to activate.`);
            } else {
                toast.error(data.error || t("theme_installFailed"));
            }
        } catch { toast.error(t("theme_installFailed")); }
        finally { setInstalling(null); }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Appearance</h3>
                    <p className="text-sm text-muted-foreground">
                        Customize the look and feel of your store.
                    </p>
                </div>
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        onChange={handleUpload}
                        className="hidden"
                    />
                    <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading...</>
                        ) : (
                            <><Upload className="w-4 h-4 mr-2" /> Upload Theme</>
                        )}
                    </Button>
                </div>
            </div>

            {uploadMessage && (
                <div className={`p-4 rounded-lg text-sm ${
                    uploadMessage.type === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                    {uploadMessage.type === "error" && <AlertTriangle className="w-4 h-4 inline mr-2" />}
                    {uploadMessage.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(Object.entries(themeRegistry) as unknown as [string, { config: { name: string; description: string; version?: string; type: string } }][]).map(([id, theme]) => {
                    const isActive = currentThemeId === id;
                    const isBuiltIn = builtInThemes.includes(id);

                    return (
                        <Card
                            key={id}
                            className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${isActive ? 'ring-2 ring-primary border-primary' : ''}`}
                            onClick={() => setTheme(id)}
                        >
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-base flex justify-between items-center">
                                    <span>{theme.config.name}</span>
                                    <div className="flex items-center gap-2">
                                        {isActive && <Check className="h-4 w-4 text-primary" />}
                                        {!isBuiltIn && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(id);
                                                }}
                                                className="text-muted-foreground hover:text-destructive transition-colors"
                                                disabled={deleting === id}
                                            >
                                                {deleting === id
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : <Trash2 className="w-3 h-3" />
                                                }
                                            </button>
                                        )}
                                    </div>
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    {theme.config.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2">
                                {renderPreview(id)}
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>v{theme.config.version || '1.0.0'}</span>
                                    <div className="flex items-center gap-2">
                                        {!isBuiltIn && <span className="text-blue-500">Custom</span>}
                                        <span>{theme.config.type}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Theme Marketplace */}
            {(() => {
                const available = marketplaceThemes.filter(t => !installedThemeIds.has(t.id));
                if (loadingMarketplace || available.length === 0) return null;
                return (
                    <div>
                        <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                            <CheckCircle className="w-5 h-5 text-blue-500" />
                            Verified Themes
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {available.map((theme: { id: string; name: string; version: string; type: string; description: string; verified: boolean; zip: string; colors?: Record<string, string> }) => (
                                <Card key={theme.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: theme.colors?.primary || "#333" }}>
                                                <Palette className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                                                    {theme.name}
                                                    {theme.verified && <CheckCircle className="w-3.5 h-3.5 text-blue-500" />}
                                                </h4>
                                                <p className="text-xs text-muted-foreground">v{theme.version} — {theme.type}</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-3">{theme.description}</p>
                                        {theme.colors && (
                                            <div className="flex gap-1 mb-3">
                                                {Object.values(theme.colors).map((c: string, i: number) => (
                                                    <div key={i} className="w-6 h-6 rounded" style={{ background: c }} />
                                                ))}
                                            </div>
                                        )}
                                        <Button size="sm" className="w-full" disabled={installing === theme.id} onClick={() => handleMarketplaceInstall(theme)}>
                                            {installing === theme.id ? <><Loader2 className="w-3 h-3 animate-spin mr-1.5" /> Installing...</> : <><Download className="w-3 h-3 mr-1.5" /> Install</>}
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Color Customizer */}
            <ColorCustomizer />

            <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                    <strong>Upload a theme:</strong> ZIP file must contain a <code className="text-xs bg-background px-1 rounded">theme.json</code> with theme configuration (id, name, colors, fonts).
                    Optionally include a <code className="text-xs bg-background px-1 rounded">components/</code> folder with TSX overrides.
                    After uploading, restart the server to activate the theme.
                </p>
            </div>
        </div>
    );
}

// Color Customizer Component
function ColorCustomizer() {
    const t = useTranslations("admin");
    const colorFields = [
        { key: "primary", label: "Primary" },
        { key: "secondary", label: "Secondary" },
        { key: "accent", label: "Accent" },
        { key: "background", label: "Background" },
        { key: "foreground", label: "Text" },
        { key: "card", label: "Card Background" },
        { key: "muted", label: "Muted" },
        { key: "destructive", label: "Destructive" },
        { key: "success", label: "Success" },
        { key: "warning", label: "Warning" },
    ];

    const [colors, setColors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((d) => {
                const s = d.settings || {};
                const c: Record<string, string> = {};
                colorFields.forEach((f) => {
                    c[f.key] = (s[`theme_color_${f.key}`] as string) || getComputedStyle(document.documentElement).getPropertyValue(`--color-${f.key}`).trim();
                });
                setColors(c);
            })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const applyColors = () => {
        Object.entries(colors).forEach(([key, value]) => {
            if (value) document.documentElement.style.setProperty(`--color-${key}`, value);
        });
    };

    const saveColors = async () => {
        setSaving(true);
        const payload: Record<string, string> = {};
        Object.entries(colors).forEach(([key, value]) => {
            payload[`theme_color_${key}`] = value;
        });
        await fetch("/api/v1/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        applyColors();
        toast.success(t("theme_colorsSaved"));
        setSaving(false);
    };

    const resetColors = () => {
        const defaults: Record<string, string> = {
            primary: "#2563eb", secondary: "#7c3aed", accent: "#06b6d4",
            background: "#f3f4f6", foreground: "#111827", card: "#ffffff",
            muted: "#f1f5f9", destructive: "#ef4444", success: "#22c55e", warning: "#f59e0b",
        };
        setColors(defaults);
        Object.entries(defaults).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--color-${key}`, value);
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Palette className="w-4 h-4" /> Color Customization
                </CardTitle>
                <CardDescription>{t("theme_overrideDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                    {colorFields.map((field) => (
                        <div key={field.key}>
                            <Label className="text-xs mb-1 block">{field.label}</Label>
                            <div className="flex gap-1">
                                <input
                                    type="color"
                                    value={colors[field.key] || "#000000"}
                                    onChange={(e) => {
                                        setColors({ ...colors, [field.key]: e.target.value });
                                        document.documentElement.style.setProperty(`--color-${field.key}`, e.target.value);
                                    }}
                                    className="w-8 h-8 rounded cursor-pointer border-0"
                                />
                                <Input
                                    value={colors[field.key] || ""}
                                    onChange={(e) => setColors({ ...colors, [field.key]: e.target.value })}
                                    className="text-xs h-8 font-mono"
                                    placeholder="#000000"
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Button size="sm" onClick={saveColors} disabled={saving}>
                        {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                        Save Colors
                    </Button>
                    <Button size="sm" variant="outline" onClick={resetColors}>{t("theme_resetDefault")}</Button>
                </div>
            </CardContent>
        </Card>
    );
}
