"use client";
import { SettingsForm } from "../settings-form";

export default function FooterSettingsPage() {
    return (
        <SettingsForm
            title="Footer Editor"
            subtitle="Customize footer content and links"
            fields={[
                { key: "footer_about_text", label: "About Text", type: "textarea", placeholder: "Brief description of your server..." },
                { key: "footer_quick_links", label: "Quick Links (JSON)", type: "textarea", placeholder: '[{"label":"Store","href":"/store"},{"label":"Forum","href":"/forum"}]', description: "JSON array of {label, href} objects" },
                { key: "footer_legal_links", label: "Legal Links (JSON)", type: "textarea", placeholder: '[{"label":"Privacy","href":"/page/privacy"},{"label":"Terms","href":"/page/terms"}]', description: "JSON array of {label, href} objects" },
                { key: "footer_copyright", label: "Copyright Text", placeholder: "© 2026 uxwVend. All rights reserved." },
            ]}
        />
    );
}
