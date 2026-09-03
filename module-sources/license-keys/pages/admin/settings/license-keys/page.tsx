"use client";

/**
 * Which store products hand out a key when an order completes.
 *
 * The product id is whatever the store calls the product. Leaving this list
 * empty is a valid configuration: keys can still be issued by hand.
 */

import { useTranslations } from "next-intl";
import { AdminCrudPage } from "@/core/sdk/admin";

export default function Page() {
    const t = useTranslations("licenseKeys");
    return (
        <AdminCrudPage
            title={t("prd_title")}
            subtitle={t("prd_subtitle")}
            apiPath="/api/v1/licenses/products"
            listKey="products"
            displayField="productId"
            secondaryField="prefix"
            fields={[
                { key: "productId", label: t("prd_productId"), required: true, placeholder: t("prd_productIdPlaceholder") },
                { key: "keysPerUnit", label: t("prd_keysPerUnit"), type: "number", defaultValue: "1" },
                { key: "maxActivations", label: t("prd_maxActivations"), type: "number", defaultValue: "1" },
                { key: "validDays", label: t("prd_validDays"), type: "number", placeholder: t("prd_validDaysPlaceholder") },
                { key: "prefix", label: t("prd_prefix"), placeholder: "PRO" },
            ]}
        />
    );
}
