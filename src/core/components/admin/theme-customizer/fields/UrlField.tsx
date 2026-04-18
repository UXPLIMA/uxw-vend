"use client";

import type { FieldProps } from "./types";

export function UrlField({ def, value, onChange, isDefault }: FieldProps<string>) {
    if (def.type !== "url") return null;
    const current = typeof value === "string" ? value : def.default ?? "";

    return (
        <label className="flex items-center gap-2 text-sm">
            <input
                type="url"
                value={current}
                onChange={(e) => onChange(e.target.value)}
                placeholder="https://…"
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
