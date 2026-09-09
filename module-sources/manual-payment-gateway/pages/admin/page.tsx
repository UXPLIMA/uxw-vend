"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function ManualPaymentSettingsPage() {
    const t = useTranslations("manualPaymentGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                {
                    key: "manual_payment_instructions",
                    label: t("adm_instructions"),
                    type: "textarea",
                    placeholder: t("adm_instructionsPlaceholder"),
                    description: t("adm_instructionsDesc"),
                },
                {
                    key: "manual_payment_currencies",
                    label: t("adm_currencies"),
                    placeholder: "TRY, EUR",
                    description: t("adm_currenciesDesc"),
                },
            ]}
        />
    );
}
