"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function AnalyticsSettingsPage() {
    const t = useTranslations("googleAnalytics");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "google_analytics_id", label: t("adm_field1Label"), placeholder: "G-XXXXXXXXXX", description: t("adm_field1Desc") },
                {
                    key: "enable_analytics",
                    label: t("adm_field2Label"),
                    description: t("adm_field2Desc"),
                    // A free-text box asking for the word "true" invites every
                    // spelling of it, and one that misses turns tracking off
                    // with no sign that it did.
                    type: "select",
                    defaultValue: "true",
                    options: [
                        { value: "true", label: t("adm_field2On") },
                        { value: "false", label: t("adm_field2Off") },
                    ],
                },
            ]}
        />
    );
}
