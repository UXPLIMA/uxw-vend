"use client";

import { useTranslations } from "next-intl";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    const t = useTranslations("store");
    return (
        <AdminCrudPage
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            apiPath="/api/v1/bulk-discounts"
            listKey="discounts"
            displayField="name"
            secondaryField="minQuantity"
            fields={[
                { key: "name", label: t("adm_field1Label"), required: true, placeholder: t("adm_field1Placeholder") },
                { key: "minQuantity", label: t("adm_field2Label"), type: "number", required: true, placeholder: t("adm_field2Placeholder") },
                { key: "discountPercent", label: t("adm_field3Label"), type: "number", required: true, placeholder: t("adm_field3Placeholder") },
                { key: "productId", label: t("adm_field4Label"), placeholder: t("adm_field4Placeholder") },
                { key: "categoryId", label: t("adm_field5Label"), placeholder: t("adm_field5Placeholder") },
                { key: "isActive", label: t("adm_field6Label"), type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
