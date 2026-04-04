"use client";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    return (
        <AdminCrudPage
            title="Changelog"
            subtitle="Version history and update notes"
            apiPath="/api/v1/changelog"
            listKey="entries"
            displayField="title"
            secondaryField="version"
            fields={[
                { key: "version", label: "Version", required: true, placeholder: "1.0.0" },
                { key: "title", label: "Title", required: true, placeholder: "What changed" },
                { key: "content", label: "Content", type: "textarea", required: true, placeholder: "Detailed changes..." },
                { key: "type", label: "Type", type: "select", options: [
                    { value: "update", label: "Update" },
                    { value: "feature", label: "New Feature" },
                    { value: "fix", label: "Bug Fix" },
                    { value: "breaking", label: "Breaking Change" },
                ], defaultValue: "update" },
            ]}
        />
    );
}
