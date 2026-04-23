"use client";

import type { FieldProps } from "./types";

export function SelectField({ def, value, onChange, isDefault }: FieldProps<string>) {
    if (def.type !== "select") return null;
    const current = typeof value === "string" ? value : def.default ?? def.options[0]?.value ?? "";

    return (
        <label className="flex items-center gap-2 text-sm">
            <select
                value={current}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 rounded border border-input bg-background px-2 text-sm"
            >
                {def.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {!isDefault && (
                <button type="button" className="text-xs underline" onClick={() => onChange(undefined)}>
                    reset
                </button>
            )}
        </label>
    );
}
