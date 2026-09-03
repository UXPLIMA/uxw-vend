"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function ParamSettingsPage() {
    const t = useTranslations("paramGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "param_client_code", label: t("adm_clientCode"), placeholder: "10738", description: t("adm_clientCodeDesc") },
                { key: "param_client_username", label: t("adm_clientUser"), placeholder: "Test", description: t("adm_clientUserDesc") },
                { key: "param_client_password", label: t("adm_clientPass"), type: "password", placeholder: "", description: t("adm_clientPassDesc") },
                { key: "param_guid", label: t("adm_guid"), type: "password", placeholder: "0c13d406-873b-403b-9c09-a5766840d98c", description: t("adm_guidDesc") },
                { key: "param_test_mode", label: t("adm_sandbox"), placeholder: "false", description: t("adm_sandboxDesc") },
            ]}
        />
    );
}
