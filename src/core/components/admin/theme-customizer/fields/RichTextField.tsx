"use client";

import { RichTextEditor } from "@/core/components/ui/rich-text-editor";
import { ResetToDefault } from "./ResetToDefault";
import type { FieldProps } from "./types";

export function RichTextField({ def, value, onChange, isDefault }: FieldProps<string>) {
    if (def.type !== "richtext") return null;
    const current = typeof value === "string" ? value : def.default ?? "";

    return (
        <div className="space-y-2">
            <RichTextEditor value={current} onChange={(v) => onChange(v)} />
            {!isDefault && <ResetToDefault onReset={() => onChange(undefined)} />}
        </div>
    );
}
