"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import { Link } from "@/core/lib/i18n/navigation";
import { Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { useRelativeTime } from "@/core/hooks/useRelativeTime";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

interface NotificationItem {
    id: string;
    title: string;
    message: string;
    type: string;
    href: string | null;
    isRead: boolean;
    createdAt: string;
}

export default function NotificationsPage() {
    const { data: session, status } = useSession();
    const t = useTranslations("inAppNotifications");
    const relativeTime = useRelativeTime();
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "unread">("all");

    const load = useCallback(async () => {
        if (!session?.user) return;
        setLoading(true);
        try {
            const res = await fetch("/api/v1/notifications");
            if (!res.ok) {
                setItems([]);
                return;
            }
            const data = await res.json();
            setItems(Array.isArray(data.notifications) ? data.notifications : []);
        } finally {
            setLoading(false);
        }
    }, [session]);

    useEffect(() => {
        if (status === "loading") return;
        if (!session?.user) {
            setLoading(false);
            return;
        }
        load();
    }, [load, session, status]);

    const markRead = async (id: string) => {
        const res = await fetch("/api/v1/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });
        if (res.ok) {
            setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } else {
            toast.error(t.has("markFailed") ? t("markFailed") : "Failed to mark as read");
        }
    };

    const markAllRead = async () => {
        const res = await fetch("/api/v1/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markAllRead: true }),
        });
        if (res.ok) {
            setItems(prev => prev.map(n => ({ ...n, isRead: true })));
            toast.success(t("markAllRead"));
        } else {
            toast.error(t.has("markFailed") ? t("markFailed") : "Failed to mark all as read");
        }
    };

    const filtered = filter === "unread" ? items.filter(n => !n.isRead) : items;
    const unreadCount = items.filter(n => !n.isRead).length;

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Bell className="w-5 h-5" /> {t("title")}
                        </h1>
                        {unreadCount > 0 && (
                            <p className="text-sm text-muted-foreground">
                                {t.has("unreadCount") ? t("unreadCount", { count: unreadCount }) : `${unreadCount} unread`}
                            </p>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <Button variant="outline" size="sm" onClick={markAllRead}>
                            <CheckCheck className="w-4 h-4 mr-1" /> {t("markAllRead")}
                        </Button>
                    )}
                </div>

                {session?.user && (
                    <div className="flex gap-2 mb-4">
                        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
                            {t("all")}
                        </Button>
                        <Button variant={filter === "unread" ? "default" : "outline"} size="sm" onClick={() => setFilter("unread")}>
                            {t("unread")}
                        </Button>
                    </div>
                )}

                {status === "loading" || loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : !session?.user ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            {t.has("loginRequired") ? t("loginRequired") : "Please log in to view your notifications."}
                        </CardContent>
                    </Card>
                ) : filtered.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            {t("noNotifications")}
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="p-0 divide-y divide-border">
                            {filtered.map(n => {
                                const body = (
                                    <div className="flex items-start gap-3 p-4">
                                        {!n.isRead && (
                                            <span className="mt-2 inline-block w-2 h-2 rounded-full bg-primary flex-shrink-0" aria-hidden="true" />
                                        )}
                                        <div className={`flex-1 min-w-0 ${n.isRead ? "pl-4" : ""}`}>
                                            <p className="font-medium text-foreground">{n.title}</p>
                                            <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{relativeTime(n.createdAt)}</p>
                                        </div>
                                        {!n.isRead && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead(n.id); }}
                                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 flex-shrink-0"
                                                aria-label={t("markRead")}
                                            >
                                                <Check className="w-3 h-3" /> {t("markRead")}
                                            </button>
                                        )}
                                    </div>
                                );
                                return n.href ? (
                                    <Link key={n.id} href={n.href} onClick={() => { if (!n.isRead) markRead(n.id); }} className="block hover:bg-muted/50 transition-colors">
                                        {body}
                                    </Link>
                                ) : (
                                    <div key={n.id} className="hover:bg-muted/30">{body}</div>
                                );
                            })}
                        </CardContent>
                    </Card>
                )}
            </main>

            <Footer />
        </div>
    );
}
