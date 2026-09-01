"use client";

import { useTranslations } from "next-intl";
import type { ThemeOption } from "../types";

interface ThemeStepProps {
    themes: ThemeOption[];
    activeTheme: string;
    setActiveTheme: (v: string) => void;
}

export function ThemeStep({ themes, activeTheme, setActiveTheme }: ThemeStepProps) {
    const t = useTranslations("setup.theme");
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
            {themes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{t("empty")}</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {themes.map((th) => {
                        const active = activeTheme === th.id;
                        return (
                            <button
                                key={th.id}
                                type="button"
                                onClick={() => setActiveTheme(th.id)}
                                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                                    active ? "border-blue-600 bg-blue-50" : "border-border bg-card hover:border-blue-300"
                                }`}
                            >
                                <div className="font-medium text-foreground">{th.name}</div>
                                {th.description && (
                                    <div className="text-xs text-muted-foreground mt-1">{th.description}</div>
                                )}
                                {th.suggestedModules && th.suggestedModules.length > 0 && (
                                    <div className="text-[11px] text-muted-foreground mt-2">
                                        {t("suggested", { modules: th.suggestedModules.join(", ") })}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
