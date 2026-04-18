import type { ThemeFieldDef } from "@/core/lib/theme-manifest-schema";

export interface FieldProps<T = unknown> {
    def: ThemeFieldDef;
    value: T | undefined;
    onChange: (value: T | undefined) => void;
    isDefault: boolean;
}
