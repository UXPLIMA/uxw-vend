"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Palette, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { useTheme } from "@/core/providers/theme-provider";
import * as Fields from "@/core/components/admin/theme-customizer/fields";
import { SuggestedModulesBanner } from "@/core/components/admin/theme/SuggestedModulesBanner";

/**
 * Active theme's appearance editor — color tokens + mode toggle.
 *
 * This page is scoped to whichever theme is currently active. The
 * multi-theme library (picker, install, delete) lives at
 * /admin/settings/theme; keeping the two concerns on separate pages
 * avoids the confusion of seeing other themes' cards while editing
 * your own.
 */
export default function ActiveThemeAppearancePage() {
    const t = useTranslations("admin");
    const { activeTheme, currentMode, setMode } = useTheme();
    const { confirm } = useConfirm();
    const [colorOverrides, setColorOverrides] = useState<Record<string, string | undefined>>({});
    const [saving, setSaving] = useState(false);

    const themeId = activeTheme?.id;
    const colorTokens = activeTheme?.tokens?.colors ?? {};
    const modes = Object.keys(activeTheme?.modes?.available ?? {});

    useEffect(() => {
        if (!themeId) return;
        fetch(`/api/v1/themes/${themeId}/customization`)
            .then((r) => r.json())
            .then((data) => {
                const modeOverrides = data?.overrides?.[currentMode];
                const colors = (modeOverrides as { tokens?: { colors?: Record<string, string> } })?.tokens?.colors ?? {};
                setColorOverrides(colors);
            })
            .catch(() => setColorOverrides({}));
    }, [themeId, currentMode]);

    const saveColors = async () => {
        if (!themeId) return;
        setSaving(true);
        const nonEmpty = Object.fromEntries(Object.entries(colorOverrides).filter(([, v]) => v !== undefined));
        const res = await fetch(`/api/v1/themes/${themeId}/customization`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode: currentMode, overrides: { tokens: { colors: nonEmpty } } }),
        });
        setSaving(false);
        if (!res.ok) { toast.error(t("theme_saveFailed")); return; }
        toast.success(t("theme_colorsSaved"));
    };

    const resetColors = async () => {
        if (!themeId) return;
        const ok = await confirm({
            title: t("theme_resetTitle"),
            message: t("theme_resetConfirm", { name: activeTheme?.name ?? "", mode: currentMode }),
            variant: "danger",
            confirmText: t("theme_reset"),
        });
        if (!ok) return;
        await fetch(`/api/v1/themes/${themeId}/customization`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode: currentMode, overrides: {} }),
        });
        setColorOverrides({});
        toast.success(t("theme_resetDone"));
    };

    const switchMode = async (m: string) => {
        if (!themeId) return;
        setMode(m);
        await fetch("/api/v1/themes/state", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ themeId, mode: m }),
        });
    };

    if (!activeTheme) {
        return <div className="p-6 text-sm text-muted-foreground">{t("theme_noActive")}</div>;
    }

    return (
        <div className="p-6 space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-semibold flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    {activeTheme.name} — {t("theme_appearanceTitle")}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {t("theme_appearanceSubtitle")}
                </p>
            </div>

            <SuggestedModulesBanner
                themeName={activeTheme.name}
                suggestions={activeTheme.suggestedModules ?? []}
            />

            {modes.length > 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">{t("theme_mode")}</CardTitle>
                        <CardDescription>{t("theme_modeDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            {modes.map((m) => (
                                <Button
                                    key={m}
                                    size="sm"
                                    variant={m === currentMode ? "default" : "outline"}
                                    onClick={() => switchMode(m)}
                                >
                                    {m}
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {Object.keys(colorTokens).length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">{t("theme_colors")}</CardTitle>
                        <CardDescription>{t("theme_overrideDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            {Object.entries(colorTokens).map(([name, def]) => {
                                const modeDefault = activeTheme.modes?.available?.[currentMode]?.tokens?.colors?.[name];
                                const effectiveDef = {
                                    ...def,
                                    label: def.label ?? name,
                                    default: modeDefault ?? def.default,
                                };
                                return (
                                    <Fields.ColorField
                                        key={name}
                                        def={effectiveDef}
                                        value={colorOverrides[name]}
                                        onChange={(v) => setColorOverrides((prev) => ({ ...prev, [name]: v }))}
                                        isDefault={colorOverrides[name] === undefined}
                                    />
                                );
                            })}
                        </div>
                        <div className="flex gap-2 mt-6">
                            <Button size="sm" onClick={saveColors} disabled={saving}>
                                <Check className="w-3 h-3 mr-1" />
                                {saving ? t("theme_saving") : t("theme_saveColors")}
                            </Button>
                            <Button size="sm" variant="outline" onClick={resetColors}>
                                {t("theme_resetDefault")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
