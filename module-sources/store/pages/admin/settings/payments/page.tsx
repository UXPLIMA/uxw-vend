"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/components/admin/SettingsForm";

export default function PaymentSettingsPage() {
    const t = useTranslations("store");
    return (
        <SettingsForm
            title={t("paymentsTitle")}
            subtitle={t("paymentsSubtitle")}
            fields={[
                { key: "stripe_public_key", label: t("paymentsStripePublicKey"), placeholder: "pk_...", description: t("paymentsStripePublicKeyDesc") },
                { key: "stripe_secret_key", label: t("paymentsStripeSecretKey"), type: "password", placeholder: "sk_...", description: t("paymentsStripeSecretKeyDesc") },
                { key: "stripe_webhook_secret", label: t("paymentsStripeWebhookSecret"), type: "password", placeholder: "whsec_...", description: t("paymentsStripeWebhookSecretDesc") },
                { key: "default_currency", label: t("paymentsDefaultCurrency"), placeholder: "usd", description: t("paymentsDefaultCurrencyDesc") },
                { key: "tax_rate", label: t("paymentsTaxRate"), type: "number", placeholder: "0", description: t("paymentsTaxRateDesc") },
            ]}
        />
    );
}
