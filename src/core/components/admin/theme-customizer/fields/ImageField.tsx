"use client";

import { FileUpload } from "@/core/components/ui/file-upload";
import type { FieldProps } from "./types";

export function ImageField({ def, value, onChange, isDefault }: FieldProps<string>) {
    if (def.type !== "image") return null;
    const current = typeof value === "string" ? value : def.default ?? null;

    return (
        <div className="space-y-2">
            <FileUpload
                value={current}
                onChange={(url) => onChange(url ?? undefined)}
                accept="image/*"
            />
            {!isDefault && (
                <button type="button" className="text-xs underline" onClick={() => onChange(undefined)}>
                    reset
                </button>
            )}
        </div>
    );
}
