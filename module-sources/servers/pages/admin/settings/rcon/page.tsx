"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/components/admin/SettingsForm";

export default function RconSettingsPage() {
    const t = useTranslations("servers");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "rcon_host", label: t("adm_field1Label"), placeholder: "127.0.0.1", description: t("adm_field1Desc") },
                { key: "rcon_port", label: t("adm_field2Label"), type: "number", placeholder: "25575", description: t("adm_field2Desc") },
                { key: "rcon_password", label: t("adm_field3Label"), type: "password", placeholder: "your-rcon-password", description: t("adm_field3Desc") },
                { key: "mc_server_host", label: t("adm_field4Label"), placeholder: "play.example.com", description: t("adm_field4Desc") },
                { key: "mc_server_port", label: t("adm_field5Label"), type: "number", placeholder: "25565", description: t("adm_field5Desc") },
            ]}
        />
    );
}
