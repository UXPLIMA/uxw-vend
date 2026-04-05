"use client";

import { useState, useEffect } from "react";
import { X, Info, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";

interface Announcement {
    id: string;
    title: string;
    content: string;
    type: string;
}

const typeConfig: Record<string, { icon: typeof Info; color: string }> = {
    info: { icon: Info, color: "var(--color-primary)" },
    warning: { icon: AlertTriangle, color: "var(--color-warning)" },
    success: { icon: CheckCircle, color: "var(--color-success)" },
    error: { icon: AlertCircle, color: "var(--color-destructive)" },
};

export function AnnouncementBanner() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    useEffect(() => {
        const stored = sessionStorage.getItem("dismissed_announcements");
        if (stored) setDismissed(new Set(JSON.parse(stored)));

        fetch("/api/v1/announcements")
            .then((r) => r.json())
            .then((d) => setAnnouncements(d.announcements || []))
            .catch(() => {});
    }, []);

    const dismiss = (id: string) => {
        const newDismissed = new Set(dismissed);
        newDismissed.add(id);
        setDismissed(newDismissed);
        sessionStorage.setItem("dismissed_announcements", JSON.stringify([...newDismissed]));
    };

    const visible = announcements.filter((a) => !dismissed.has(a.id));
    if (visible.length === 0) return null;

    return (
        <div>
            {visible.map((announcement) => {
                const config = typeConfig[announcement.type] || typeConfig.info;
                const Icon = config.icon;

                return (
                    <div
                        key={announcement.id}
                        className="px-4 py-2.5"
                        style={{ backgroundColor: "var(--color-card)", borderBottom: `2px solid ${config.color}` }}
                    >
                        <div className="container mx-auto flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
                                <div className="min-w-0">
                                    <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>{announcement.title}</span>
                                    {announcement.content !== announcement.title && (
                                        <span className="text-sm ml-2" style={{ color: "var(--color-muted-foreground)" }}>{announcement.content}</span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => dismiss(announcement.id)}
                                className="flex-shrink-0 p-1 rounded transition-opacity opacity-50 hover:opacity-100"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
