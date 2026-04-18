"use client";

import { useTranslations } from "next-intl";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    const t = useTranslations("store");
    return (
        <AdminCrudPage
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            apiPath="/api/v1/creator-codes"
            listKey="codes"
            displayField="code"
            secondaryField="creatorId"
            fields={[
                { key: "code", label: t("adm_field1Label"), required: true, placeholder: t("adm_field1Placeholder") },
                { key: "creatorId", label: t("adm_field2Label"), required: true, placeholder: t("adm_field2Placeholder") },
                { key: "discountPercent", label: t("adm_field3Label"), type: "number", placeholder: t("adm_field3Placeholder"), defaultValue: "5" },
                { key: "commissionPercent", label: t("adm_field4Label"), type: "number", placeholder: t("adm_field4Placeholder"), defaultValue: "5" },
                { key: "isActive", label: t("adm_field5Label"), type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
