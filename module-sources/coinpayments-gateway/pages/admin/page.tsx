"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function CoinPaymentsSettingsPage() {
    const t = useTranslations("coinpaymentsGateway");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                { key: "coinpayments_merchant_id", label: t("adm_merchantId"), placeholder: "", description: t("adm_merchantIdDesc") },
                { key: "coinpayments_ipn_secret", label: t("adm_ipnSecret"), type: "password", placeholder: "", description: t("adm_ipnSecretDesc") },
            ]}
        />
    );
}
