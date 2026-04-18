"use client";

import { useState, useEffect } from "react";
import { ShoppingCart } from "lucide-react";
import { Link } from "@/core/lib/i18n/navigation";
import { useSession } from "next-auth/react";

export function CartIcon() {
    const { data: session } = useSession();
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!session?.user) return;
        fetch("/api/v1/store/cart").then(r => {
            if (!r.ok) return;
            r.json().then(d => setCount(d.itemCount || 0));
        }).catch(() => {});
    }, [session]);

    if (!session?.user) return null;

    return (
        <Link href="/store/cart" className="relative p-2 rounded-md text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors">
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
