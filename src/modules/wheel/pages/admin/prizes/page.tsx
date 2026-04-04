"use client";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    return (
        <AdminCrudPage
            title="Wheel Prizes"
            subtitle="Configure Wheel of Fortune prizes"
            apiPath="/api/v1/wheel/prizes"
            listKey="prizes"
            displayField="name"
            secondaryField="type"
            fields={[
                { key: "name", label: "Prize Name", required: true, placeholder: "50 Credits" },
                { key: "type", label: "Prize Type", type: "select", required: true, options: [
                    { value: "credits", label: "Credits" },
                    { value: "coupon", label: "Coupon" },
                    { value: "nothing", label: "Nothing (Better luck!)" },
                ], defaultValue: "credits" },
                { key: "value", label: "Value", type: "number", placeholder: "50", defaultValue: "0" },
                { key: "color", label: "Wheel Color", type: "color", defaultValue: "#3b82f6" },
                { key: "probability", label: "Weight (1-100)", type: "number", placeholder: "10", defaultValue: "10" },
                { key: "isActive", label: "Active", type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
