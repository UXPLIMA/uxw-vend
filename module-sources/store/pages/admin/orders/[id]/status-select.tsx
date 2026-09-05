"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { adminOrderStatusKeys, ORDER_STATUSES, orderStatusLabel } from "../../../../lib/order-status";
import { NativeSelect } from "@/core/sdk/ui";

/** The admin catalogue's copy of the order status labels. */
const ADMIN_ORDER_STATUS_KEYS = adminOrderStatusKeys("adm_orderStatus_");

/**
 * A tint per status, expressed as an alpha over the theme's own colour rather
 * than a light-mode swatch. `bg-yellow-50` is a near-white that a dark panel
 * turns into a glowing rectangle; `bg-yellow-500/10` reads as a tint on both.
 */
const statusColors: Record<string, string> = {
    PENDING: "border-yellow-500/40 bg-yellow-500/10",
    PROCESSING: "border-blue-500/40 bg-blue-500/10",
    COMPLETED: "border-green-500/40 bg-green-500/10",
    CANCELLED: "border-red-500/40 bg-red-500/10",
    REFUNDED: "border-border bg-muted",
};

interface OrderStatusSelectProps {
    orderId: string;
    currentStatus: string;
}

export function OrderStatusSelect({ orderId, currentStatus }: OrderStatusSelectProps) {
    const t = useTranslations("store");
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
            <NativeSelect
                value={status}
                onChange={(e) => handleChange(e.target.value)}
                disabled={saving}
                aria-label={t("adm_status")}
                inputSize="sm"
                className={statusColors[status] || ""}
            >
                {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>{orderStatusLabel(t, ADMIN_ORDER_STATUS_KEYS, s)}</option>
                ))}
            </NativeSelect>
            {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            {saved && <Check className="w-3 h-3 text-green-500" />}
        </div>
    );
}
