"use client";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    return (
        <AdminCrudPage
            title="Creator Codes"
            subtitle="Influencer discount codes with commission"
            apiPath="/api/v1/creator-codes"
            listKey="codes"
            displayField="code"
            secondaryField="creatorId"
            fields={[
                { key: "code", label: "Code", required: true, placeholder: "CREATOR10" },
                { key: "creatorId", label: "Creator User ID", required: true, placeholder: "User ID of the creator" },
                { key: "discountPercent", label: "Customer Discount (%)", type: "number", placeholder: "5", defaultValue: "5" },
                { key: "commissionPercent", label: "Creator Commission (%)", type: "number", placeholder: "5", defaultValue: "5" },
                { key: "isActive", label: "Active", type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
