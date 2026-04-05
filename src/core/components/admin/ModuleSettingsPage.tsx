"use client";

import { SettingsForm } from "@/core/components/admin/SettingsForm";

interface ModuleSettingsPageProps {
    title: string;
    description: string;
    fields: {
        key: string;
        label: string;
        type?: "text" | "number" | "toggle" | "textarea" | "url";
        placeholder?: string;
        description?: string;
        defaultValue?: string | number | boolean;
    }[];
}

export function ModuleSettingsPage({ title, description, fields }: ModuleSettingsPageProps) {
    return <SettingsForm title={title} subtitle={description} fields={fields as Parameters<typeof SettingsForm>[0]["fields"]} />;
}
