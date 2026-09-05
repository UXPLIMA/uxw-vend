"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/core/components/ui/button";

/**
 * "Put this one back."
 *
 * All nine theme fields carried their own copy of this control, written as a
 * bare `<button className="text-xs underline">reset</button>` - in English,
 * on every locale, and looking like nothing else in the panel. It is one
 * control, so it is one component.
 */
export function ResetToDefault({ onReset }: { onReset: () => void }) {
    const t = useTranslations("admin");
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            title={t("theme_resetFieldHint")}
        >
            <RotateCcw className="w-3.5 h-3.5" />
            {t("theme_resetField")}
        </Button>
    );
}
