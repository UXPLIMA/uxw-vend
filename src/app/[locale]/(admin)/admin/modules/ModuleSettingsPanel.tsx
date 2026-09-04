"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Loader2 } from "lucide-react";
import type { Module, ModuleSettingValues } from "./types";

/**
 * The settings form for one installed module, built entirely from what that
 * module's manifest declares.
 *
 * Core knows none of these keys. A module adds a `settings` entry and gets a
 * labelled, bounded control here, with no core change - the same contract every
 * other module surface follows. Before this existed the declarations were
 * invisible: an admin had no way to reach a single one of them.
 */
export function ModuleSettingsPanel({
    module: mod,
    onSave,
}: {
    module: Module;
    onSave: (moduleId: string, config: ModuleSettingValues) => Promise<boolean>;
}) {
    const t = useTranslations("admin");
    const declarations = mod.settings ?? [];
    const stored: ModuleSettingValues = mod.config ?? {};

    const [values, setValues] = useState<ModuleSettingValues>(() => {
        const initial: ModuleSettingValues = {};
        for (const setting of declarations) {
            initial[setting.key] = stored[setting.key] ?? setting.default;
        }
        return initial;
    });
    const [saving, setSaving] = useState(false);

    if (declarations.length === 0) return null;

    const dirty = declarations.some((s) => values[s.key] !== (stored[s.key] ?? s.default));

    const save = async () => {
        setSaving(true);
        await onSave(mod.id, values);
        setSaving(false);
    };

    return (
        <div className="mb-3 border-t pt-3 space-y-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                {t("modules_settings")}
            </h4>

            {declarations.map((setting) => {
                const id = `module-setting-${mod.id}-${setting.key}`;
                const value = values[setting.key];
                return (
                    <div key={setting.key} className="text-xs">
                        {setting.type === "boolean" ? (
                            <label htmlFor={id} className="flex items-start gap-2 cursor-pointer">
                                <input
                                    id={id}
                                    type="checkbox"
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
                                    checked={value === true}
                                    onChange={(e) =>
                                        setValues((v) => ({ ...v, [setting.key]: e.target.checked }))
                                    }
                                />
                                <span>
                                    <span className="font-medium">{setting.label}</span>
                                    {setting.description && (
                                        <span className="block text-muted-foreground">{setting.description}</span>
                                    )}
                                </span>
                            </label>
                        ) : (
                            <div className="space-y-1">
                                <label htmlFor={id} className="font-medium block">{setting.label}</label>
                                {setting.description && (
                                    <span className="block text-muted-foreground">{setting.description}</span>
                                )}
                                <Input
                                    id={id}
                                    className="h-8 text-xs"
                                    type={setting.type === "number" ? "number" : "text"}
                                    min={setting.min}
                                    max={setting.max}
                                    maxLength={setting.maxLength}
                                    value={String(value ?? "")}
                                    onChange={(e) =>
                                        setValues((v) => ({
                                            ...v,
                                            [setting.key]:
                                                setting.type === "number"
                                                    // An empty box is not a number. Keep the declared
                                                    // default rather than sending NaN, which the server
                                                    // would reject as "must be a finite number".
                                                    ? (e.target.value === "" ? setting.default : Number(e.target.value))
                                                    : e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        )}
                    </div>
                );
            })}

            <Button size="sm" className="w-full text-xs" disabled={!dirty || saving} onClick={save}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : t("modules_settingsSave")}
            </Button>
        </div>
    );
}
