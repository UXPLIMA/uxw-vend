"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function TawktoSettingsPage() {
    const t = useTranslations("tawktoChat");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "tawkto_property_id", label: t("adm_propertyId"), description: t("adm_propertyIdDesc") },
                { key: "tawkto_widget_id", label: t("adm_widgetId"), description: t("adm_widgetIdDesc") },
            ]}
        />
    );
}
