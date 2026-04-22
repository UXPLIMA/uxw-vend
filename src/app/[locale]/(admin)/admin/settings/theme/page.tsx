"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Check, Upload, Loader2, Trash2, AlertTriangle, Palette, Download, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

import { themeRegistry } from "@/core/generated/theme-registry";
import { useTheme } from "@/core/providers/theme-provider";
import * as Fields from "@/core/components/admin/theme-customizer/fields";
import { SuggestedModulesBanner } from "@/core/components/admin/theme/SuggestedModulesBanner";

export default function ThemeSettingsPage() {
    const t = useTranslations("admin");
    const { activeTheme, currentThemeId, currentMode, setMode } = useTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const { confirm } = useConfirm();

    // Schema-driven color overrides
    const [colorOverrides, setColorOverrides] = useState<Record<string, string | undefined>>({});

    // Load persisted overrides when active theme or mode changes
    useEffect(() => {
        if (!activeTheme?.id) return;
        fetch(`/api/v1/themes/${activeTheme.id}/customization`)
            .then(r => r.json())
            .then(data => {
                const modeOverrides = data?.overrides?.[currentMode];
                const colors = (modeOverrides as { tokens?: { colors?: Record<string, string> } })?.tokens?.colors ?? {};
                setColorOverrides(colors);
            })
            .catch(() => {});
    }, [activeTheme?.id, currentMode]);

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

    const handleThemeSwitch = async (themeId: string) => {
        await fetch("/api/v1/themes/state", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ themeId, mode: currentMode }),
        });
        location.reload();
    };

    const saveColors = async () => {
        if (!activeTheme?.id) return;
        const nonEmpty = Object.fromEntries(
            Object.entries(colorOverrides).filter(([, v]) => v !== undefined)
        ) as Record<string, string>;
        await fetch(`/api/v1/themes/${activeTheme.id}/customization`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode: currentMode, overrides: { tokens: { colors: nonEmpty } } }),
        });
        toast.success(t("theme_colorsSaved") ?? "Colors saved");
    };

    const resetColors = async () => {
        if (!activeTheme?.id) return;
        const ok = await confirm({ title: "Reset Colors", message: "Discard all color overrides?", variant: "danger", confirmText: "Reset" });
        if (!ok) return;
        await fetch(`/api/v1/themes/${activeTheme.id}/customization`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode: currentMode, overrides: {} }),
        });
        setColorOverrides({});
        toast.success(t("theme_resetDefault") ?? "Reset");
    };

    const renderPreview = (themeId: string) => {
        const theme = themeRegistry[themeId];
        if (!theme) return null;
        const colorDefs = theme.tokens?.colors ?? {};
        const colorFor = (k: string): string => {
            const def = colorDefs[k];
            return def && "default" in def && typeof def.default === "string" ? def.default : "#000";
        };
        const colors = {
            background: colorFor("background"),
            border: colorFor("border"),
            muted: colorFor("muted"),
            destructive: colorFor("destructive"),
            warning: colorFor("warning"),
            success: colorFor("success"),
            primary: colorFor("primary"),
            secondary: colorFor("secondary"),
        };

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

    // Mode toggle
    const modes = Object.keys(activeTheme?.modes?.available ?? {});

    // Schema-driven color tokens from active theme
    const colorTokens = activeTheme?.tokens?.colors ?? {};

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

            {/* Suggested modules banner */}
            <SuggestedModulesBanner
                themeName={activeTheme?.name ?? ""}
                suggestions={activeTheme?.suggestedModules ?? []}
            />

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

            {/* Mode toggle — only visible when there is more than one mode */}
            {modes.length > 1 && (
                <div className="flex gap-2">
                    {modes.map(m => (
                        <Button
                            key={m}
                            variant={m === currentMode ? "default" : "outline"}
                            onClick={() => {
                                setMode(m);
                                fetch("/api/v1/themes/state", {
                                    method: "PUT",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({ themeId: activeTheme?.id, mode: m }),
                                });
                            }}
                        >
                            {m}
                        </Button>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(themeRegistry).map(([id, theme]) => {
                    const isActive = currentThemeId === id;
                    const isBuiltIn = builtInThemes.includes(id);

                    return (
                        <Card
                            key={id}
                            className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${isActive ? 'ring-2 ring-primary border-primary' : ''}`}
                            onClick={() => handleThemeSwitch(id)}
                        >
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-base flex justify-between items-center">
                                    <span>{theme.name}</span>
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
                                    {theme.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2">
                                {renderPreview(id)}
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>v{theme.version || '1.0.0'}</span>
                                    <div className="flex items-center gap-2">
                                        {!isBuiltIn && <span className="text-blue-500">Custom</span>}
                                        <span>{theme.modes?.default ?? "—"}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Theme Marketplace */}
            {(() => {
                const available = marketplaceThemes.filter(th => !installedThemeIds.has(th.id));
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

            {/* Schema-driven color customizer */}
            {Object.keys(colorTokens).length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Palette className="w-4 h-4" />
                            {t("theme_colors") ?? "Color Customization"}
                        </CardTitle>
                        <CardDescription>{t("theme_overrideDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            {Object.entries(colorTokens).map(([name, def]) => (
                                <Fields.ColorField
                                    key={name}
                                    def={{ ...def, label: def.label ?? name }}
                                    value={colorOverrides[name]}
                                    onChange={(v) => setColorOverrides(prev => ({ ...prev, [name]: v }))}
                                    isDefault={colorOverrides[name] === undefined}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button size="sm" onClick={saveColors}>
                                <Check className="w-3 h-3 mr-1" />
                                Save Colors
                            </Button>
                            <Button size="sm" variant="outline" onClick={resetColors}>
                                {t("theme_resetDefault") ?? "Reset to Defaults"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

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
