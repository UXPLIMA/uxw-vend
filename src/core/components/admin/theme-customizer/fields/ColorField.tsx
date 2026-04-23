"use client";

import type { FieldProps } from "./types";

export function ColorField({ def, value, onChange, isDefault }: FieldProps<string>) {
    if (def.type !== "color") return null;
    const effective = typeof value === "string" ? value : def.default ?? "#000000";
    return (
        <label className="flex items-center gap-3 text-sm">
            <input
                type="color"
                value={effective}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 w-12 cursor-pointer rounded border flex-shrink-0"
            />
            <span className="flex flex-col min-w-0">
                {def.label && <span className="font-medium">{def.label}</span>}
                <span className="font-mono text-xs text-muted-foreground">{effective}</span>
            </span>
            {!isDefault && (
                <button type="button" className="text-xs underline ml-auto" onClick={() => onChange(undefined)}>
                    reset
                </button>
            )}
        </label>
    );
}
