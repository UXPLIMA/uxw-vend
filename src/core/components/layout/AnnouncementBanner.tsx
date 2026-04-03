"use client";

import { useState, useEffect } from "react";
import { X, Info, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";

interface Announcement {
    id: string;
    title: string;
    content: string;
    type: string;
}

const typeStyles: Record<string, { bg: string; border: string; icon: typeof Info }> = {
    info: { bg: "bg-blue-50", border: "border-blue-200", icon: Info },
    warning: { bg: "bg-yellow-50", border: "border-yellow-200", icon: AlertTriangle },
    success: { bg: "bg-green-50", border: "border-green-200", icon: CheckCircle },
    error: { bg: "bg-red-50", border: "border-red-200", icon: AlertCircle },
};

export function AnnouncementBanner() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Load dismissed from sessionStorage
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
        <div className="space-y-0">
            {visible.map((announcement) => {
                const style = typeStyles[announcement.type] || typeStyles.info;
                const Icon = style.icon;

                return (
                    <div
                        key={announcement.id}
                        className={`${style.bg} border-b ${style.border} px-4 py-2.5`}
                    >
                        <div className="container mx-auto flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <div className="min-w-0">
                                    <span className="text-sm font-medium">{announcement.title}</span>
                                    {announcement.content !== announcement.title && (
                                        <span className="text-sm text-gray-600 ml-2">{announcement.content}</span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => dismiss(announcement.id)}
                                className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
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
