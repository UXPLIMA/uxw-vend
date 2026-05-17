"use client";

import { useTranslations } from "next-intl";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    const t = useTranslations("changelog");
    return (
        <AdminCrudPage
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            apiPath="/api/v1/changelog"
            listKey="entries"
            displayField="title"
            secondaryField="version"
            fields={[
                { key: "version", label: t("adm_field1Label"), required: true, placeholder: t("adm_field1Placeholder") },
                { key: "title", label: t("adm_field2Label"), required: true, placeholder: t("adm_field2Placeholder") },
                { key: "content", label: t("adm_field3Label"), type: "richtext", required: true, placeholder: t("adm_field3Placeholder") },
                { key: "type", label: t("adm_field4Label"), placeholder: t("adm_field4Placeholder"), defaultValue: "update" },
                { key: "color", label: "Color", type: "color", defaultValue: "#3b82f6" },
            ]}
        />
    );
}
