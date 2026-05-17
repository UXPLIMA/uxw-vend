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
                { key: "name", label: t("svr_name"), required: true, placeholder: t("svr_namePlaceholder") },
                {
                    key: "type",
                    label: t("svr_type"),
                    type: "select",
                    required: true,
                    defaultValue: "minecraft",
                    options: [
                        { value: "minecraft", label: t("svr_typeMinecraft") },
                        { value: "fivem", label: t("svr_typeFivem") },
                        { value: "rust", label: t("svr_typeRust") },
                        { value: "ark", label: t("svr_typeArk") },
                        { value: "csgo", label: t("svr_typeCsgo") },
                    ],
                },
                { key: "host", label: t("svr_host"), required: true, placeholder: t("svr_hostPlaceholder") },
                { key: "port", label: t("svr_port"), type: "number", defaultValue: "25565" },
                { key: "queryPort", label: t("svr_queryPort"), type: "number", placeholder: t("svr_queryPortPlaceholder") },
                { key: "rconPort", label: t("svr_rconPort"), type: "number", placeholder: t("svr_rconPortPlaceholder") },
                { key: "rconPassword", label: t("svr_rconPassword"), type: "text", placeholder: t("svr_rconPasswordPlaceholder") },
                { key: "isDefault", label: t("svr_isDefault"), type: "toggle", defaultValue: "false" },
                { key: "isActive", label: t("svr_isActive"), type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
