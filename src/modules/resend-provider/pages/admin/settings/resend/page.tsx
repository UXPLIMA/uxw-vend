"use client";
import { SettingsForm } from "./settings-form";

export default function ResendSettingsPage() {
    return (
        <SettingsForm
            title="Resend Email Provider"
            subtitle="Configure Resend API for sending transactional emails"
            fields={[
                { key: "resend_api_key", label: "Resend API Key", type: "password", placeholder: "re_...", description: "Get your API key from resend.com/api-keys" },
                { key: "email_from", label: "From Email", type: "email", placeholder: "noreply@yoursite.com", description: "Sender email address (must be verified in Resend)" },
                { key: "email_from_name", label: "From Name", placeholder: "uxwVend", description: "Display name for outgoing emails" },
            ]}
        />
    );
}
