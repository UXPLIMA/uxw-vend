"use client";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    return (
        <AdminCrudPage
            title="Popups"
            subtitle="Welcome modals and promotional popups"
            apiPath="/api/v1/popups"
            listKey="popups"
            displayField="title"
            secondaryField="content"
            fields={[
                { key: "title", label: "Title", required: true, placeholder: "Welcome!" },
                { key: "content", label: "Content", type: "textarea", placeholder: "Check out our latest deals..." },
                { key: "image", label: "Image URL", type: "url", placeholder: "https://..." },
                { key: "link", label: "Button Link", type: "url", placeholder: "https://..." },
                { key: "linkText", label: "Button Text", placeholder: "Learn More" },
                { key: "isActive", label: "Active", type: "toggle", defaultValue: "true" },
                { key: "startsAt", label: "Start Date", type: "datetime" },
                { key: "endsAt", label: "End Date", type: "datetime" },
            ]}
        />
    );
}
