"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function InvoicingSettingsPage() {
    const t = useTranslations("parasutInvoicing");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "parasut_company_id", label: t("adm_companyId"), description: t("adm_companyIdDesc") },
                { key: "parasut_client_id", label: t("adm_clientId") },
                { key: "parasut_client_secret", label: t("adm_clientSecret"), type: "password" },
                { key: "parasut_username", label: t("adm_username"), description: t("adm_usernameDesc") },
                { key: "parasut_password", label: t("adm_password"), type: "password" },
            ]}
        />
    );
}
