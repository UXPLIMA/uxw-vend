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
 * than a light-mode swatch. `bg-warning/10` is a near-white that a dark panel
 * turns into a glowing rectangle; a tint of the theme's own warning colour
 * reads correctly on both, and follows a theme that recolours the panel.
 */
const statusColors: Record<string, string> = {
    PENDING: "border-warning/40 bg-warning/10",
    PROCESSING: "border-primary/40 bg-primary/10",
    COMPLETED: "border-success/40 bg-success/10",
    CANCELLED: "border-destructive/40 bg-destructive/10",
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
            {saved && <Check className="w-3 h-3 text-success" />}
        </div>
    );
}
