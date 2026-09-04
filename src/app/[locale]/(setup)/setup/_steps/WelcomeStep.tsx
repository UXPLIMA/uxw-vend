"use client";

import { useTranslations } from "next-intl";

export function WelcomeStep() {
    const t = useTranslations("setup.welcome");
    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold text-foreground">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("body")}</p>
            <p className="text-xs text-muted-foreground italic">{t("note")}</p>
        </div>
    );
}
