"use client";

import { ResetToDefault } from "./ResetToDefault";
import type { FieldProps } from "./types";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/core/components/ui/checkbox";

export function ToggleField({ def, value, onChange, isDefault }: FieldProps<boolean>) {
    const t = useTranslations("admin");
    if (def.type !== "toggle") return null;
    const current = typeof value === "boolean" ? value : def.default ?? false;

    return (
        <label className="flex items-center gap-2 text-sm">
            <Checkbox
                checked={current}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span className="text-xs text-muted-foreground">{current ? t("enabled") : t("disabled")}</span>
            {!isDefault && <ResetToDefault onReset={() => onChange(undefined)} />}
        </label>
    );
}
