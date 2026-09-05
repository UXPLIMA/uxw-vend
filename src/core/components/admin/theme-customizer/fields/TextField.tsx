"use client";

import { Input } from "@/core/components/ui/input";
import { ResetToDefault } from "./ResetToDefault";
import type { FieldProps } from "./types";

export function TextField({ def, value, onChange, isDefault }: FieldProps<string>) {
    if (def.type !== "text") return null;
    const current = typeof value === "string" ? value : def.default ?? "";

    return (
        <label className="flex items-center gap-2 text-sm">
            <Input
                type="text"
                value={current}
                maxLength={def.max ?? 10000}
                onChange={(e) => onChange(e.target.value)}
                aria-label={def.label}
            />
            {!isDefault && <ResetToDefault onReset={() => onChange(undefined)} />}
        </label>
    );
}
