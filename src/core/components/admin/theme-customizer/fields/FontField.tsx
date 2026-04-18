"use client";

import type { FieldProps } from "./types";

export function FontField({ def, value, onChange, isDefault }: FieldProps<string>) {
    if (def.type !== "font") return null;
    const current = typeof value === "string" ? value : def.default ?? "";
    const hasOptions = Array.isArray(def.options) && def.options.length > 0;

    return (
        <label className="flex items-center gap-2 text-sm">
            {hasOptions ? (
                <select
                    value={current}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-8 rounded border border-input bg-background px-2 text-sm"
                >
                    {def.default && !def.options!.includes(def.default) && (
                        <option value={def.default}>{def.default}</option>
                    )}
                    {def.options!.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    type="text"
                    value={current}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={def.default ?? "Font stack"}
                    className="h-8 rounded border border-input bg-background px-2 text-sm"
                />
            )}
            {!isDefault && (
                <button type="button" className="text-xs underline" onClick={() => onChange(undefined)}>
                    reset
                </button>
            )}
        </label>
    );
}
