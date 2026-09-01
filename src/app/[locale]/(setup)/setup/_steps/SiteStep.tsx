"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/core/components/ui/input";

/** Locales the wizard offers. Must stay a subset of `src/core/lib/i18n/config`. */
const LOCALE_OPTIONS = [
    { code: "en", label: "English" },
    { code: "tr", label: "Türkçe" },
    { code: "de", label: "Deutsch" },
    { code: "es", label: "Español" },
    { code: "fr", label: "Français" },
    { code: "ru", label: "Русский" },
    { code: "pt", label: "Português" },
];

interface SiteStepProps {
    siteName: string;
    siteDescription: string;
    defaultLocaleCode: string;
    setSiteName: (v: string) => void;
    setSiteDescription: (v: string) => void;
    setDefaultLocaleCode: (v: string) => void;
}

export function SiteStep({
    siteName, siteDescription, defaultLocaleCode,
    setSiteName, setSiteDescription, setDefaultLocaleCode,
}: SiteStepProps) {
    const t = useTranslations("setup.site");
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
            <div className="space-y-3">
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("name")}</span>
                    <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("descriptionField")}</span>
                    <Input value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} />
                    <span className="text-xs text-muted-foreground">{t("descriptionHint")}</span>
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("locale")}</span>
                    <select
                        value={defaultLocaleCode}
                        onChange={(e) => setDefaultLocaleCode(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                    >
                        {LOCALE_OPTIONS.map((l) => (
                            <option key={l.code} value={l.code}>{l.label}</option>
                        ))}
                    </select>
                </label>
            </div>
        </div>
    );
}
