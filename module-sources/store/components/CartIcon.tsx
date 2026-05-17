"use client";

import { useCallback, useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { useSession } from "next-auth/react";

export function CartIcon() {
    const { data: session } = useSession();
    const t = useTranslations("store");
    const [count, setCount] = useState(0);

    const refresh = useCallback(() => {
        if (!session?.user) return;
        fetch("/api/v1/store/cart")
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setCount(d.itemCount || 0); })
            .catch(() => {});
    }, [session]);

    useEffect(() => { refresh(); }, [refresh]);

    // Other components (product page add-to-cart, cart page) dispatch this
    // event so the navbar badge updates immediately without a full reload.
    useEffect(() => {
        const onUpdate = () => refresh();
        window.addEventListener("cart:updated", onUpdate);
        return () => window.removeEventListener("cart:updated", onUpdate);
    }, [refresh]);

    if (!session?.user) return null;

    const ariaLabel = t.has("cartAriaLabel") ? t("cartAriaLabel") : "Cart";

    return (
        <Link
            href="/store/cart"
            aria-label={ariaLabel}
            className="relative p-2 rounded-md text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors"
        >
            <ShoppingCart className="w-4 h-4" />
            {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {count > 9 ? "9+" : count}
                </span>
            )}
        </Link>
    );
}

export default CartIcon;
