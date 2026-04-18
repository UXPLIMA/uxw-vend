"use client";

import { useTranslations } from "next-intl";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    const t = useTranslations("staff");
    return (
        <AdminCrudPage
            title={t("adm_members_title")}
            subtitle={t("adm_members_subtitle")}
            apiPath="/api/v1/staff"
            listKey="members"
            displayField="name"
            secondaryField="role"
            fields={[
                { key: "name", label: t("adm_members_field1Label"), required: true, placeholder: t("adm_members_field1Placeholder") },
                { key: "role", label: t("adm_members_field2Label"), required: true, placeholder: t("adm_members_field2Placeholder") },
                { key: "avatar", label: t("adm_members_field3Label"), type: "url", placeholder: t("adm_members_field3Placeholder") },
                { key: "order", label: t("adm_members_field4Label"), type: "number", placeholder: t("adm_members_field4Placeholder") },
                { key: "isActive", label: t("adm_members_field5Label"), type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
