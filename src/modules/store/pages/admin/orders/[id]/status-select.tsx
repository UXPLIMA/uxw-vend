"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

const statusOptions = ["PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED"];

const statusColors: Record<string, string> = {
    PENDING: "border-yellow-200 bg-yellow-50",
    PROCESSING: "border-blue-200 bg-blue-50",
    COMPLETED: "border-green-200 bg-green-50",
    CANCELLED: "border-red-200 bg-red-50",
    REFUNDED: "border-gray-200 bg-gray-50",
};

interface OrderStatusSelectProps {
    orderId: string;
    currentStatus: string;
}

export function OrderStatusSelect({ orderId, currentStatus }: OrderStatusSelectProps) {
    const [status, setStatus] = useState(currentStatus);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleChange = async (newStatus: string) => {
        if (newStatus === status) return;
        setSaving(true);
        setSaved(false);

        try {
            const res = await fetch(`/api/v1/store/orders/${orderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });

            if (res.ok) {
                setStatus(newStatus);
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (err) {
            console.error("Failed to update status:", err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <select
                value={status}
                onChange={(e) => handleChange(e.target.value)}
                disabled={saving}
                className={`text-sm px-3 py-1.5 rounded-md border cursor-pointer ${statusColors[status] || ""}`}
            >
                {statusOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                ))}
            </select>
            {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            {saved && <Check className="w-3 h-3 text-green-500" />}
        </div>
    );
}
