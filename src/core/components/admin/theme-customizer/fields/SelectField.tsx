"use client";

import { ResetToDefault } from "./ResetToDefault";
import type { FieldProps } from "./types";
import { NativeSelect } from "@/core/components/ui/native-select";

export function SelectField({ def, value, onChange, isDefault }: FieldProps<string>) {
    if (def.type !== "select") return null;
    const current = typeof value === "string" ? value : def.default ?? def.options[0]?.value ?? "";

    return (
        <label className="flex items-center gap-2 text-sm">
            <NativeSelect
                value={current}
                onChange={(e) => onChange(e.target.value)} inputSize="sm"
            >
                {def.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </NativeSelect>
            {!isDefault && <ResetToDefault onReset={() => onChange(undefined)} />}
        </label>
    );
}
