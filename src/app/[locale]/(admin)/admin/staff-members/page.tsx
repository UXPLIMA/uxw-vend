"use client";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    return (
        <AdminCrudPage
            title="Staff Members"
            subtitle="Manage the team shown on the staff page"
            apiPath="/api/v1/staff"
            listKey="members"
            displayField="name"
            secondaryField="role"
            fields={[
                { key: "name", label: "Display Name", required: true, placeholder: "John Doe" },
                { key: "role", label: "Role Title", required: true, placeholder: "Administrator" },
                { key: "avatar", label: "Avatar URL", type: "url", placeholder: "https://..." },
                { key: "order", label: "Display Order", type: "number", placeholder: "0" },
                { key: "isActive", label: "Visible", type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
