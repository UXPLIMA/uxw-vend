"use client";

import { useTranslations } from "next-intl";
import type { PresetOption } from "../types";

interface SiteTypeStepProps {
    presets: PresetOption[];
    selected: string | null;
    onSelect: (p: PresetOption) => void;
}

export function SiteTypeStep({ presets, selected, onSelect }: SiteTypeStepProps) {
    const t = useTranslations("setup.type");
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
            {presets.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{t("unavailable")}</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {presets.map((p) => {
                        const active = selected === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => onSelect(p)}
                                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                                    active ? "border-blue-600 bg-blue-50" : "border-border bg-card hover:border-blue-300"
                                }`}
                            >
                                <div className="font-medium text-foreground">{p.name}</div>
                                {p.description && (
                                    <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
                                )}
                                <div className="text-[11px] text-blue-700 mt-2">
                                    {p.modules.length > 0
                                        ? t("moduleCount", { count: p.modules.length })
                                        : t("noModules")}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
