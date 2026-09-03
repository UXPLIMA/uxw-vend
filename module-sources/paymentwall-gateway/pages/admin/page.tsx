"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function PaymentwallSettingsPage() {
    const t = useTranslations("paymentwallGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "paymentwall_project_key", label: t("adm_projectKey"), placeholder: "", description: t("adm_projectKeyDesc") },
                { key: "paymentwall_secret_key", label: t("adm_secretKey"), type: "password", placeholder: "", description: t("adm_secretKeyDesc") },
            ]}
        />
    );
}
