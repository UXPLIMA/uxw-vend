"use client";
import { SettingsForm } from "../settings-form";

export default function SecuritySettingsPage() {
    return (
        <SettingsForm
            title="Security"
            subtitle="CAPTCHA, bot protection, and security settings"
            fields={[
                { key: "turnstile_site_key", label: "Cloudflare Turnstile Site Key", placeholder: "0x...", description: "Get from Cloudflare Dashboard → Turnstile" },
                { key: "turnstile_secret_key", label: "Turnstile Secret Key", type: "password", placeholder: "0x...", description: "Server-side verification key" },
                { key: "enable_captcha_login", label: "Enable CAPTCHA on Login", placeholder: "true", description: "Set 'true' to require CAPTCHA on login form" },
                { key: "enable_captcha_register", label: "Enable CAPTCHA on Register", placeholder: "true", description: "Set 'true' to require CAPTCHA on registration" },
                { key: "enable_email_verification", label: "Require Email Verification", placeholder: "false", description: "Set 'true' to require email verification before purchases" },
                { key: "max_login_attempts", label: "Max Login Attempts", type: "number", placeholder: "10", description: "Lock account after N failed attempts per minute" },
            ]}
        />
    );
}
