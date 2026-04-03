"use client";

import React, { useState, useRef } from "react";
import { useTheme as useNextTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Check, Upload, Loader2, Trash2, AlertTriangle } from "lucide-react";

import { themeRegistry } from "@/core/generated/theme-registry";

export default function ThemeSettingsPage() {
    const { setTheme, theme: currentThemeId } = useNextTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

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
        if (!confirm(`Delete theme "${themeId}"? This cannot be undone.`)) return;

        setDeleting(themeId);
        try {
            const res = await fetch(`/api/v1/themes/${themeId}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "Failed to delete theme");
            } else {
                setUploadMessage({ type: "success", text: data.message });
            }
        } catch {
            alert("Failed to delete theme");
        } finally {
            setDeleting(null);
        }
    };

    const renderPreview = (themeId: string) => {
        const theme = themeRegistry[themeId];
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

    const builtInThemes = ["flat", "retro"];

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
                {Object.entries(themeRegistry).map(([id, theme]) => {
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
