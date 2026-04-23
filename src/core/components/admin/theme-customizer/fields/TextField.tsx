"use client";

import type { FieldProps } from "./types";

export function TextField({ def, value, onChange, isDefault }: FieldProps<string>) {
    if (def.type !== "text") return null;
    const current = typeof value === "string" ? value : def.default ?? "";

    return (
        <label className="flex items-center gap-2 text-sm">
            <input
                type="text"
                value={current}
                maxLength={def.max ?? 10000}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 flex-1 rounded border border-input bg-background px-2 text-sm"
            />
            {!isDefault && (
                <button type="button" className="text-xs underline" onClick={() => onChange(undefined)}>
                    reset
                </button>
            )}
        </label>
    );
}
