"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

/**
 * Polls /api/v1/modules/updates every 10 minutes (and once on mount).
 * Renders a small badge in the admin sidebar / topbar when modules are
 * out of date. Click navigates to /admin/modules/updates.
 */
export function ModuleUpdateBadge() {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const check = async () => {
            try {
                const res = await fetch("/api/v1/modules/updates");
                if (res.ok && !cancelled) {
                    const data = await res.json();
                    setCount(data.count || 0);
                }
            } catch { /* ignore */ }
        };

        check();
        const interval = setInterval(check, 10 * 60 * 1000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    if (count === 0) return null;

    return (
        <Link
            href="/admin/modules/updates"
            className="relative inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-xs font-medium hover:bg-orange-200 dark:hover:bg-orange-950/60 transition-colors"
            title={`${count} module update${count === 1 ? "" : "s"} available`}
        >
            <Bell className="w-3 h-3" />
            {count}
            <span className="hidden sm:inline">update{count === 1 ? "" : "s"}</span>
        </Link>
    );
}
