"use client";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    return (
        <AdminCrudPage
            title="Vote Sites"
            subtitle="Manage voting links and rewards"
            apiPath="/api/v1/vote"
            listKey="sites"
            displayField="name"
            secondaryField="url"
            fields={[
                { key: "name", label: "Site Name", required: true, placeholder: "MinecraftServers.org" },
                { key: "url", label: "Vote URL", type: "url", required: true, placeholder: "https://..." },
                { key: "reward", label: "Credit Reward", type: "number", placeholder: "10", defaultValue: "10" },
                { key: "icon", label: "Icon (emoji)", placeholder: "🗳️" },
                { key: "isActive", label: "Active", type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
