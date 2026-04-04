"use client";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    return (
        <AdminCrudPage
            title="Announcements"
            subtitle="Site-wide banners and notifications"
            apiPath="/api/v1/announcements"
            listKey="announcements"
            displayField="title"
            secondaryField="type"
            fields={[
                { key: "title", label: "Title", required: true, placeholder: "Announcement title" },
                { key: "content", label: "Content", type: "textarea", required: true, placeholder: "Announcement message" },
                { key: "type", label: "Type", type: "select", options: [
                    { value: "info", label: "Info (Blue)" },
                    { value: "warning", label: "Warning (Yellow)" },
                    { value: "success", label: "Success (Green)" },
                    { value: "error", label: "Error (Red)" },
                ], defaultValue: "info" },
                { key: "isActive", label: "Active", type: "toggle", defaultValue: "true" },
                { key: "startsAt", label: "Start Date", type: "datetime" },
                { key: "endsAt", label: "End Date", type: "datetime" },
            ]}
        />
    );
}
