"use client";

import type { FieldProps } from "./types";

export function SliderField({ def, value, onChange, isDefault }: FieldProps<number>) {
    if (def.type !== "slider") return null;
    const current = typeof value === "number" ? value : def.default ?? def.min;

    return (
        <label className="flex items-center gap-2 text-sm">
            <input
                type="range"
                min={def.min}
                max={def.max}
                step={def.step ?? 1}
                value={current}
                onChange={(e) => onChange(Number(e.target.value))}
                className="h-8 cursor-pointer"
            />
            <span className="font-mono text-xs text-muted-foreground w-12 text-right">{current}</span>
            {!isDefault && (
                <button type="button" className="text-xs underline" onClick={() => onChange(undefined)}>
                    reset
                </button>
            )}
        </label>
    );
}
