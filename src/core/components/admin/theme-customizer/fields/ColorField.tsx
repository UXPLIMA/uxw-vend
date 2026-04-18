"use client";

import type { FieldProps } from "./types";

export function ColorField({ def, value, onChange, isDefault }: FieldProps<string>) {
    if (def.type !== "color") return null;
    return (
        <label className="flex items-center gap-2 text-sm">
            <input
                type="color"
                value={typeof value === "string" ? value : def.default ?? "#000000"}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 w-12 cursor-pointer rounded border"
            />
            <span className="font-mono text-xs text-muted-foreground">{value ?? def.default ?? "—"}</span>
            {!isDefault && (
                <button type="button" className="text-xs underline" onClick={() => onChange(undefined)}>
                    reset
                </button>
            )}
        </label>
    );
}
