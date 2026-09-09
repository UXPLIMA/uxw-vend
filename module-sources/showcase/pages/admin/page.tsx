"use client";

import { useTranslations } from "next-intl";
import { AdminCrudPage } from "@/core/sdk/admin";

export default function ShowcaseAdminPage() {
    const t = useTranslations("showcase");
    return (
        <AdminCrudPage
            title={t("adm_title")}
            subtitle={t("adm_subtitleWithHint")}
            apiPath="/api/v1/showcase/cards"
            listKey="cards"
            displayField="title"
            secondaryField="href"
            fields={[
                { key: "title", label: t("adm_cardTitle"), required: true },
                { key: "body", label: t("adm_cardBody"), type: "textarea" },
                { key: "image", label: t("adm_cardImage"), placeholder: "/uploads/one.png" },
                { key: "href", label: t("adm_cardHref"), placeholder: "/store" },
                { key: "order", label: t("adm_cardOrder"), type: "number" },
            ]}
        />
    );
}
