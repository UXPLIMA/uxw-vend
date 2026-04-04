"use client";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    return (
        <AdminCrudPage
            title="Slider"
            subtitle="Manage homepage slider/carousel images"
            apiPath="/api/v1/slider"
            listKey="items"
            displayField="title"
            secondaryField="image"
            fields={[
                { key: "title", label: "Title", placeholder: "Slide title (optional)" },
                { key: "subtitle", label: "Subtitle", placeholder: "Subtitle text (optional)" },
                { key: "image", label: "Image URL", type: "url", required: true, placeholder: "https://..." },
                { key: "link", label: "Link URL", type: "url", placeholder: "https://... or /store" },
                { key: "order", label: "Order", type: "number", defaultValue: "0" },
                { key: "isActive", label: "Active", type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
