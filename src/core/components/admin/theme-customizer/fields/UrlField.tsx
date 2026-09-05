"use client";

import { Input } from "@/core/components/ui/input";
import { ResetToDefault } from "./ResetToDefault";
import type { FieldProps } from "./types";

export function UrlField({ def, value, onChange, isDefault }: FieldProps<string>) {
    if (def.type !== "url") return null;
    const current = typeof value === "string" ? value : def.default ?? "";

    return (
        <label className="flex items-center gap-2 text-sm">
            <Input
                type="url"
                value={current}
                onChange={(e) => onChange(e.target.value)}
                placeholder="https://…"
                aria-label={def.label}
            />
            {!isDefault && <ResetToDefault onReset={() => onChange(undefined)} />}
        </label>
    );
}
