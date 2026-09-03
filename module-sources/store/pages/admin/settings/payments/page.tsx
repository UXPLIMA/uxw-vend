"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function PaymentSettingsPage() {
    const t = useTranslations("store");
    return (
        <SettingsForm
            title={t("paymentsTitle")}
            subtitle={t("paymentsSubtitle")}
            fields={[
                { key: "default_currency", label: t("paymentsDefaultCurrency"), placeholder: "usd", description: t("paymentsDefaultCurrencyDesc") },
                { key: "tax_rate", label: t("paymentsTaxRate"), type: "number", placeholder: "0", description: t("paymentsTaxRateDesc") },
            ]}
        />
    );
}
