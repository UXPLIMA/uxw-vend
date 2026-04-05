"use client";
import { SettingsForm } from "./settings-form";

export default function StripeSettingsPage() {
    return (
        <SettingsForm
            title="Stripe Configuration"
            subtitle="Configure Stripe payment gateway"
            fields={[
                { key: "stripe_public_key", label: "Publishable Key", placeholder: "pk_...", description: "Publishable key from Stripe Dashboard" },
                { key: "stripe_secret_key", label: "Secret Key", type: "password", placeholder: "sk_...", description: "Secret key (keep this private)" },
                { key: "stripe_webhook_secret", label: "Webhook Secret", type: "password", placeholder: "whsec_...", description: "Webhook signing secret" },
            ]}
        />
    );
}
