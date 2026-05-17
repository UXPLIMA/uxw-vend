"use client";

import { useTranslations } from "next-intl";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    const t = useTranslations("store");
    return (
        <AdminCrudPage
            title={t("bd_title")}
            subtitle={t("bd_subtitle")}
            apiPath="/api/v1/bulk-discounts"
            listKey="discounts"
            displayField="name"
            secondaryRender={(item) => {
                const min = Number(item.minQuantity ?? 0);
                const pct = Number(item.discountPercent ?? 0);
                return `${min}+ → ${pct}%`;
            }}
            fields={[
                { key: "name", label: t("bd_nameLabel"), required: true, placeholder: t("bd_namePlaceholder") },
                { key: "minQuantity", label: t("bd_minQuantityLabel"), type: "number", required: true, placeholder: t("bd_minQuantityPlaceholder") },
                { key: "discountPercent", label: t("bd_discountPercentLabel"), type: "number", required: true, placeholder: t("bd_discountPercentPlaceholder") },
                { key: "productId", label: t("bd_productIdLabel"), placeholder: t("bd_productIdPlaceholder") },
                { key: "categoryId", label: t("bd_categoryIdLabel"), placeholder: t("bd_categoryIdPlaceholder") },
                { key: "isActive", label: t("bd_isActiveLabel"), type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
