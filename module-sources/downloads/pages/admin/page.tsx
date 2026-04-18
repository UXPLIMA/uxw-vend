"use client";

import { useTranslations } from "next-intl";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    const t = useTranslations("downloads");
    return (
        <AdminCrudPage
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            apiPath="/api/v1/downloads"
            listKey="downloads"
            displayField="title"
            secondaryField="fileName"
            fields={[
                { key: "title", label: t("adm_field1Label"), required: true, placeholder: t("adm_field1Placeholder") },
                { key: "description", label: t("adm_field2Label"), type: "richtext", placeholder: t("adm_field2Placeholder") },
                { key: "fileName", label: t("adm_field3Label"), required: true, placeholder: t("adm_field3Placeholder") },
                { key: "fileUrl", label: t("adm_field4Label"), type: "urlOrFile", required: true, placeholder: t("adm_field4Placeholder") },
                { key: "fileSize", label: t("adm_field5Label"), type: "number", placeholder: t("adm_field5Placeholder") },
                { key: "isActive", label: t("adm_field6Label"), type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
