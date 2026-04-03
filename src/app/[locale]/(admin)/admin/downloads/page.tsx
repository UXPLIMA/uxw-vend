"use client";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    return (
        <AdminCrudPage
            title="Downloads"
            subtitle="Manage downloadable files and resources"
            apiPath="/api/v1/downloads"
            listKey="downloads"
            displayField="title"
            secondaryField="fileName"
            fields={[
                { key: "title", label: "Title", required: true, placeholder: "Resource Pack v1.0" },
                { key: "description", label: "Description", type: "textarea", placeholder: "What this file contains..." },
                { key: "fileName", label: "File Name", required: true, placeholder: "resource-pack.zip" },
                { key: "fileUrl", label: "File URL", type: "url", required: true, placeholder: "https://cdn.example.com/file.zip" },
                { key: "fileSize", label: "File Size (bytes)", type: "number", placeholder: "1048576" },
                { key: "isActive", label: "Active", type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
