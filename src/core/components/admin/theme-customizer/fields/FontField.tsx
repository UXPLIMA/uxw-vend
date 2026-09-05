"use client";

import { ResetToDefault } from "./ResetToDefault";
import type { FieldProps } from "./types";
import { NativeSelect } from "@/core/components/ui/native-select";
import { Input } from "@/core/components/ui/input";

export function FontField({ def, value, onChange, isDefault }: FieldProps<string>) {
    if (def.type !== "font") return null;
    const current = typeof value === "string" ? value : def.default ?? "";
    const hasOptions = Array.isArray(def.options) && def.options.length > 0;

    return (
        <label className="flex items-center gap-2 text-sm">
            {hasOptions ? (
                <NativeSelect
                    value={current}
                    onChange={(e) => onChange(e.target.value)} inputSize="sm"
                >
                    {def.default && !def.options!.includes(def.default) && (
                        <option value={def.default}>{def.default}</option>
                    )}
                    {def.options!.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </NativeSelect>
            ) : (
                <Input
                    type="text"
                    value={current}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={def.default ?? "Inter, system-ui, sans-serif"}
                    aria-label={def.label}
                    className="font-mono text-xs"
                />
            )}
            {!isDefault && <ResetToDefault onReset={() => onChange(undefined)} />}
        </label>
    );
}
