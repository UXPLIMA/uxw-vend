"use client";
import { SettingsForm } from "../settings-form";
import { useTranslations } from "next-intl";

export default function FooterSettingsPage() {
    const t = useTranslations("admin");
    return (
        <SettingsForm
            title={t("footer_title")}
            subtitle={t("footer_subtitle")}
            fields={[
                { key: "footer_about_text", label: t("footer_aboutText"), type: "textarea", placeholder: "Brief description of your server..." },
                { key: "footer_quick_links", label: t("footer_quickLinks"), type: "textarea", placeholder: '[{"label":"Link 1","href":"/page1"},{"label":"Link 2","href":"/page2"}]', description: t("footer_quickLinksDesc") },
                { key: "footer_legal_links", label: t("footer_legalLinks"), type: "textarea", placeholder: '[{"label":"Privacy","href":"/page/privacy"},{"label":"Terms","href":"/page/terms"}]', description: t("footer_legalLinksDesc") },
                { key: "footer_copyright", label: t("footer_copyright"), placeholder: "© 2026 uxwVend. All rights reserved." },
            ]}
        />
    );
}
