"use client";
import { SettingsForm } from "../settings-form";

export default function EmailSettingsPage() {
    return (
        <SettingsForm
            title="Email Settings"
            subtitle="Configure email service and customize templates"
            fields={[
                { key: "resend_api_key", label: "Resend API Key", type: "password", placeholder: "re_...", description: "Get from resend.com/api-keys" },
                { key: "email_from", label: "From Email", type: "email", placeholder: "noreply@yoursite.com" },
                { key: "email_from_name", label: "From Name", placeholder: "uxwVend" },
                { key: "email_welcome_subject", label: "Welcome Email Subject", placeholder: "Welcome to {appName}!", description: "Variables: {appName}, {username}" },
                { key: "email_welcome_body", label: "Welcome Email Body (HTML)", type: "textarea", description: "Variables: {username}, {email}, {appName}" },
                { key: "email_order_subject", label: "Order Confirmation Subject", placeholder: "Order #{orderNumber}", description: "Variables: {orderNumber}, {total}" },
                { key: "email_reset_subject", label: "Password Reset Subject", placeholder: "Reset your password" },
            ]}
        />
    );
}
