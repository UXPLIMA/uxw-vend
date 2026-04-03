"use client";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    return (
        <AdminCrudPage
            title="Bulk Discounts"
            subtitle="Quantity-based automatic discounts"
            apiPath="/api/v1/bulk-discounts"
            listKey="discounts"
            displayField="name"
            secondaryField="minQuantity"
            fields={[
                { key: "name", label: "Name", required: true, placeholder: "Buy 3 get 10% off" },
                { key: "minQuantity", label: "Minimum Quantity", type: "number", required: true, placeholder: "3" },
                { key: "discountPercent", label: "Discount (%)", type: "number", required: true, placeholder: "10" },
                { key: "productId", label: "Product ID (optional)", placeholder: "Leave empty for all products" },
                { key: "categoryId", label: "Category ID (optional)", placeholder: "Leave empty for all categories" },
                { key: "isActive", label: "Active", type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
