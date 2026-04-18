"use client";

import { useTranslations } from "next-intl";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    const t = useTranslations("servers");
    return (
        <AdminCrudPage
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            apiPath="/api/v1/servers"
            listKey="servers"
            displayField="name"
            secondaryField="host"
            fields={[
                { key: "name", label: t("adm_field1Label"), required: true, placeholder: t("adm_field1Placeholder") },
                { key: "type", label: t("adm_field2Label"), type: "select", required: true, options: [
                    { value: "minecraft", label: t("adm_field3Label") },
                    { value: "fivem", label: t("adm_field4Label") },
                    { value: "rust", label: t("adm_field5Label") },
                    { value: "ark", label: t("adm_field6Label") },
                    { value: "csgo", label: t("adm_field7Label") },
                ], defaultValue: "minecraft" },
                { key: "host", label: t("adm_field8Label"), required: true, placeholder: t("adm_field2Placeholder") },
                { key: "port", label: t("adm_field9Label"), type: "number", defaultValue: "25565" },
                { key: "queryPort", label: t("adm_field10Label"), type: "number", placeholder: t("adm_field3Placeholder") },
                { key: "rconPort", label: t("adm_field11Label"), type: "number", placeholder: t("adm_field4Placeholder") },
                { key: "rconPassword", label: t("adm_field12Label"), type: "text", placeholder: t("adm_field5Placeholder") },
                { key: "isDefault", label: t("adm_field13Label"), type: "toggle", defaultValue: "false" },
                { key: "isActive", label: t("adm_field14Label"), type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
