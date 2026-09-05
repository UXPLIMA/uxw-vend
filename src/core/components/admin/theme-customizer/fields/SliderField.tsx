"use client";

import { Slider } from "@/core/components/ui/slider";
import { ResetToDefault } from "./ResetToDefault";
import type { FieldProps } from "./types";

export function SliderField({ def, value, onChange, isDefault }: FieldProps<number>) {
    if (def.type !== "slider") return null;
    const current = typeof value === "number" ? value : def.default ?? def.min;

    return (
        <label className="flex items-center gap-2 text-sm">
            <Slider
                min={def.min}
                max={def.max}
                step={def.step ?? 1}
                value={current}
                onChange={(e) => onChange(Number(e.target.value))}
            />
            <span className="font-mono text-xs text-muted-foreground w-12 text-right">{current}</span>
            {!isDefault && <ResetToDefault onReset={() => onChange(undefined)} />}
        </label>
    );
}
