"use client";
import { SettingsForm } from "../settings-form";

export default function PaymentSettingsPage() {
    return (
        <SettingsForm
            title="Payment Settings"
            subtitle="Configure Stripe and payment options"
            fields={[
                { key: "stripe_public_key", label: "Stripe Public Key", placeholder: "pk_...", description: "Publishable key from Stripe Dashboard" },
                { key: "stripe_secret_key", label: "Stripe Secret Key", type: "password", placeholder: "sk_...", description: "Secret key (keep this private)" },
                { key: "stripe_webhook_secret", label: "Stripe Webhook Secret", type: "password", placeholder: "whsec_...", description: "Webhook signing secret" },
                { key: "default_currency", label: "Default Currency", placeholder: "usd", description: "ISO 4217 currency code (usd, eur, try, etc.)" },
                { key: "tax_rate", label: "Tax Rate (%)", type: "number", placeholder: "0", description: "Applied to all orders. Set 0 for no tax." },
            ]}
        />
    );
}
