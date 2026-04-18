"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Link } from "@/core/lib/i18n/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

export function NotificationBell() {
    const { data: session } = useSession();
    const t = useTranslations("inAppNotifications");
    const [unread, setUnread] = useState(0);
    const [available, setAvailable] = useState(false);

    useEffect(() => {
        if (!session?.user) return;
        fetch("/api/v1/notifications").then(r => {
            if (!r.ok) return;
            setAvailable(true);
            r.json().then(d => setUnread(d.unread || 0));
        }).catch(() => {});
    }, [session]);

    if (!available || !session?.user) return null;

    return (
        <Link href="/profile" className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title={t("title")}>
            <Bell className="w-4 h-4" />
            {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {unread > 9 ? "9+" : unread}
                </span>
            )}
        </Link>
    );
}

export default NotificationBell;
