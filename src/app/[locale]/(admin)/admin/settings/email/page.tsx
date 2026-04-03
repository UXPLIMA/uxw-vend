"use client";
import { SettingsForm } from "../settings-form";

export default function EmailSettingsPage() {
    return (
        <SettingsForm
            title="Email Settings"
            subtitle="Configure email service for notifications"
            fields={[
                { key: "resend_api_key", label: "Resend API Key", type: "password", placeholder: "re_...", description: "Get your API key from resend.com/api-keys" },
                { key: "email_from", label: "From Email", type: "email", placeholder: "noreply@yoursite.com", description: "Sender email address" },
                { key: "email_from_name", label: "From Name", placeholder: "uxwVend", description: "Sender display name" },
            ]}
        />
    );
}
