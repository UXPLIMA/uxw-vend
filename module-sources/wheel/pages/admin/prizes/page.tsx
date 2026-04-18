"use client";

import { useTranslations } from "next-intl";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    const t = useTranslations("wheel");
    return (
        <AdminCrudPage
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            apiPath="/api/v1/wheel/prizes"
            listKey="prizes"
            displayField="name"
            secondaryField="type"
            fields={[
                { key: "name", label: t("adm_field1Label"), required: true, placeholder: t("adm_field1Placeholder") },
                { key: "type", label: t("adm_field2Label"), type: "select", required: true, options: [
                    { value: "credits", label: t("adm_field3Label") },
                    { value: "coupon", label: t("adm_field4Label") },
                    { value: "nothing", label: t("adm_field5Label") },
                ], defaultValue: "credits" },
                { key: "value", label: t("adm_field6Label"), type: "number", placeholder: t("adm_field2Placeholder"), defaultValue: "0" },
                { key: "color", label: t("adm_field7Label"), type: "color", defaultValue: "#3b82f6" },
                { key: "probability", label: t("adm_field8Label"), type: "number", placeholder: t("adm_field3Placeholder"), defaultValue: "10" },
                { key: "isActive", label: t("adm_field9Label"), type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
