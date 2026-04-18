"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/components/admin/SettingsForm";

export default function AnalyticsSettingsPage() {
    const t = useTranslations("googleAnalytics");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "google_analytics_id", label: t("adm_field1Label"), placeholder: "G-XXXXXXXXXX", description: t("adm_field1Desc") },
                { key: "enable_analytics", label: t("adm_field2Label"), placeholder: "true", description: t("adm_field2Desc") },
            ]}
        />
    );
}
