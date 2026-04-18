"use client";

import { useTranslations } from "next-intl";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    const t = useTranslations("vote");
    return (
        <AdminCrudPage
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            apiPath="/api/v1/vote"
            listKey="sites"
            displayField="name"
            secondaryField="url"
            fields={[
                { key: "name", label: t("adm_field1Label"), required: true, placeholder: t("adm_field1Placeholder") },
                { key: "url", label: t("adm_field2Label"), type: "url", required: true, placeholder: t("adm_field2Placeholder") },
                { key: "reward", label: t("adm_field3Label"), type: "number", placeholder: t("adm_field3Placeholder"), defaultValue: "10" },
                { key: "icon", label: t("adm_field4Label"), placeholder: t("adm_field4Placeholder") },
                { key: "isActive", label: t("adm_field5Label"), type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
