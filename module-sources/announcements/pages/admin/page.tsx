"use client";

import { useTranslations } from "next-intl";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    const t = useTranslations("announcements");
    return (
        <AdminCrudPage
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            apiPath="/api/v1/announcements"
            listKey="announcements"
            displayField="title"
            secondaryField="type"
            fields={[
                { key: "title", label: t("adm_field1Label"), required: true, placeholder: t("adm_field1Placeholder") },
                { key: "content", label: t("adm_field2Label"), type: "textarea", required: true, placeholder: t("adm_field2Placeholder") },
                { key: "type", label: t("adm_field3Label"), type: "select", options: [
                    { value: "info", label: t("adm_field4Label") },
                    { value: "warning", label: t("adm_field5Label") },
                    { value: "success", label: t("adm_field6Label") },
                    { value: "error", label: t("adm_field7Label") },
                ], defaultValue: "info" },
                { key: "isActive", label: t("adm_field8Label"), type: "toggle", defaultValue: "true" },
                { key: "dismissible", label: t("adm_field9Label"), type: "toggle", defaultValue: "true" },
                { key: "includePages", label: t("adm_field10Label"), placeholder: t("adm_field3Placeholder") },
                { key: "excludePages", label: t("adm_field11Label"), placeholder: t("adm_field4Placeholder") },
                { key: "startsAt", label: t("adm_field12Label"), type: "datetime" },
                { key: "endsAt", label: t("adm_field13Label"), type: "datetime" },
            ]}
        />
    );
}
