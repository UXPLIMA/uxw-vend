
"use client";

import React from "react";
import { useTheme } from "@/core/providers/theme-provider";
import { useTheme as useNextTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Check, Palette } from "lucide-react";

// Actually, I should use the hook `useTheme` from provider which exposes `themes` via context?
// My provider exposes `activeTheme`. But I need the LIST of themes.
// The provider relies on `next-themes` for the list. `useNextTheme` gives me `themes` (list of strings).
// But I need the METADATA (name, description, colors) for each theme to show a preview.
// So I should import `themeRegistry` directly here. 
// Ideally, this data should be passed down or available via context, but importing the registry is fine for a client component 
// if the registry is just a static object (which it is, generated at build time).

import { themeRegistry } from "@/core/generated/theme-registry";

export default function ThemeSettingsPage() {
    const { setTheme, theme: currentThemeId } = useNextTheme();

    // Helper to render preview
    const renderPreview = (themeId: string) => {
        const theme = themeRegistry[themeId];
        if (!theme) return null;

        const { colors } = theme.config;

        return (
            <div className="w-full h-32 rounded-md mb-4 relative overflow-hidden border border-border" style={{ background: colors.background }}>
                {/* Simulated UI Elements */}
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

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Appearance</h3>
                <p className="text-sm text-muted-foreground">
                    Customize the look and feel of your store.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(themeRegistry).map(([id, theme]) => {
                    const isActive = currentThemeId === id;

                    return (
                        <Card
                            key={id}
                            className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${isActive ? 'ring-2 ring-primary border-primary' : ''}`}
                            onClick={() => setTheme(id)}
                        >
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-base flex justify-between items-center">
                                    {theme.config.name}
                                    {isActive && <Check className="h-4 w-4 text-primary" />}
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    {theme.config.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2">
                                {renderPreview(id)}
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>v{theme.config.version || '1.0.0'}</span>
                                    <span>{theme.config.type}</span>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
