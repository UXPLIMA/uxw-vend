"use client";

import type { FieldProps } from "./types";
import { Checkbox } from "@/core/components/ui/checkbox";

export function ToggleField({ def, value, onChange, isDefault }: FieldProps<boolean>) {
    if (def.type !== "toggle") return null;
    const current = typeof value === "boolean" ? value : def.default ?? false;

    return (
        <label className="flex items-center gap-2 text-sm">
            <Checkbox
                checked={current}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span className="text-xs text-muted-foreground">{current ? "On" : "Off"}</span>
            {!isDefault && (
                <button type="button" className="text-xs underline" onClick={() => onChange(undefined)}>
                    reset
                </button>
            )}
        </label>
    );
}
