"use client";
import { SettingsForm } from "../settings-form";

export default function AnalyticsSettingsPage() {
    return (
        <SettingsForm
            title="Analytics"
            subtitle="Configure tracking and analytics services"
            fields={[
                { key: "google_analytics_id", label: "Google Analytics Measurement ID", placeholder: "G-XXXXXXXXXX", description: "From Google Analytics → Admin → Data Streams" },
                { key: "enable_analytics", label: "Enable Analytics", placeholder: "true", description: "Set 'true' to enable. Only loads after cookie consent." },
            ]}
        />
    );
}
