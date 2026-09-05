"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { Link } from "@/core/sdk/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRelativeTime } from "@/core/sdk/ui";
import { useModalDialog } from "@/core/sdk/ui";

interface NotificationItem {
    id: string;
    title: string;
    message: string;
    type: string;
    href: string | null;
    isRead: boolean;
    createdAt: string;
}

export function NotificationBell() {
    const { data: session } = useSession();
    const t = useTranslations("inAppNotifications");
    const relativeTime = useRelativeTime();
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [unread, setUnread] = useState(0);
    const [available, setAvailable] = useState(false);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        if (!session?.user) return;
        try {
            const res = await fetch("/api/v1/notifications");
            if (!res.ok) return;
            setAvailable(true);
            const data = await res.json();
            setItems(Array.isArray(data.notifications) ? data.notifications : []);
            setUnread(data.unread || 0);
        } catch { /* ignore */ }
    }, [session]);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    // A panel, not a modal: the page behind it stays usable, so Tab is left
    // alone. Escape still closes it and focus goes back to the bell.
    const panelRef = useModalDialog<HTMLDivElement>(open, () => setOpen(false), {
        trapFocus: false,
        autoFocus: false,
    });

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    /**
     * Both mark-read calls used to swallow the answer, so a rejected PATCH
     * still cleared the badge - and the badge is the only thing telling the
     * reader there is something to come back to. On a failure the count is
     * left where it was.
     */
    const markRead = async (id: string) => {
        const res = await fetch("/api/v1/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        }).catch(() => null);
        if (!res?.ok) return;
        setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        setUnread(n => Math.max(0, n - 1));
    };

    const markAllRead = async () => {
        const res = await fetch("/api/v1/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markAllRead: true }),
        }).catch(() => null);
        if (!res?.ok) return;
        setItems(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnread(0);
    };

    if (!available || !session?.user) return null;

    const recent = items.slice(0, 6);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-label={t("title")}
                aria-expanded={open}
                aria-haspopup="dialog"
                className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={t("title")}
            >
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-label={t("title")}
                    className="absolute right-0 top-full mt-1 w-80 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden"
                >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                        <span className="font-medium text-sm">{t("title")}</span>
                        {unread > 0 && (
                            <button
                                type="button"
                                onClick={markAllRead}
                                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            >
                                <CheckCheck className="w-3 h-3" /> {t("markAllRead")}
                            </button>
                        )}
                    </div>

                    {recent.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            {t("noNotifications")}
                        </div>
                    ) : (
                        <ul className="max-h-80 overflow-y-auto divide-y divide-border">
                            {recent.map(n => {
                                const body = (
                                    <div className="flex items-start gap-2 p-3 hover:bg-muted/50 transition-colors">
                                        {!n.isRead && (
                                            <span className="mt-1.5 inline-block w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                        )}
                                        <div className={`flex-1 min-w-0 ${n.isRead ? "pl-4" : ""}`}>
                                            <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                                            <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">{relativeTime(n.createdAt)}</p>
                                        </div>
                                    </div>
                                );
                                return (
                                    <li key={n.id}>
                                        {n.href ? (
                                            <Link
                                                href={n.href}
                                                onClick={() => { if (!n.isRead) markRead(n.id); setOpen(false); }}
                                                className="block"
                                            >
                                                {body}
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => { if (!n.isRead) markRead(n.id); }}
                                                className="w-full text-left"
                                                aria-label={n.isRead ? n.title : `${n.title} - ${t("markRead")}`}
                                            >
                                                {body}
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    <Link
                        href="/notifications"
                        onClick={() => setOpen(false)}
                        className="block px-3 py-2 text-xs text-center text-primary hover:bg-muted border-t border-border inline-flex items-center justify-center gap-1 w-full"
                    >
                        {t.has("viewAll") ? t("viewAll") : "View all"} <ExternalLink className="w-3 h-3" />
                    </Link>
                </div>
            )}
        </div>
    );
}

export default NotificationBell;
