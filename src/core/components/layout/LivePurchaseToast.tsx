"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export function LivePurchaseToast() {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        // Check if live purchase notifications are enabled
        fetch("/api/v1/public-settings")
            .then((r) => r.json())
            .then((d) => {
                if (d.settings?.live_purchase_toast === "true" || d.settings?.live_purchase_toast === true) {
                    setEnabled(true);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!enabled) return;

        // Poll for recent orders every 30 seconds
        let lastOrderId = "";

        const poll = async () => {
            try {
                const res = await fetch("/api/v1/store/orders?limit=1");
                if (!res.ok) return;
                const data = await res.json();
                const orders = data.orders || [];
                if (orders.length > 0 && orders[0].id !== lastOrderId && lastOrderId !== "") {
                    const order = orders[0];
                    const item = order.items?.[0];
                    toast.info(
                        `${order.user?.username || "Someone"} purchased ${item?.product?.name || "an item"}`,
                        { duration: 5000 }
                    );
                }
                if (orders.length > 0) lastOrderId = orders[0].id;
            } catch { /* ignore */ }
        };

        poll();
        const interval = setInterval(poll, 30000);
        return () => clearInterval(interval);
    }, [enabled]);

    return null;
}
