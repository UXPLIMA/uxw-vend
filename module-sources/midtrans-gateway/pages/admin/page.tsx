"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function MidtransSettingsPage() {
    const t = useTranslations("midtransGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "midtrans_server_key", label: t("adm_serverKey"), type: "password", placeholder: "SB-Mid-server-...", description: t("adm_serverKeyDesc") },
                { key: "midtrans_test_mode", label: t("adm_sandbox"), placeholder: "false", description: t("adm_sandboxDesc") },
            ]}
        />
    );
}
