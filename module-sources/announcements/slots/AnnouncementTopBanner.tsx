"use client";

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";

interface Announcement {
    id: string;
    title: string;
    content: string;
    type?: string;
    dismissible?: boolean;
}

/**
 * Full-width dismissible banner above the navbar showing the most
 * recent pinned announcement. Dismissal is persisted per-announcement
 * in localStorage.
 */
export default function AnnouncementTopBanner() {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);

    useEffect(() => {
        let active = true;
        fetch("/api/v1/announcements")
            .then((r) => (r.ok ? r.json() : { announcements: [] }))
            .then((d: { announcements?: Announcement[] }) => {
                if (!active) return;
                // Endpoint already filters isActive + time bounds; take the
                // most recent one that the user hasn't yet dismissed.
                const items = d.announcements || [];
                if (typeof window === "undefined") {
                    if (items[0]) setAnnouncement(items[0]);
                    return;
                }
                const first = items.find((a) => !localStorage.getItem(`announcement-dismissed:${a.id}`));
                if (first) setAnnouncement(first);
            })
            .catch(() => undefined);
        return () => { active = false; };
    }, []);

    if (!announcement) return null;

    const dismiss = () => {
        if (typeof window !== "undefined") {
            localStorage.setItem(`announcement-dismissed:${announcement.id}`, "1");
        }
        setAnnouncement(null);
    };

    const typeClasses: Record<string, string> = {
        info: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
        warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
        success: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
        error: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
    };

    const variant = typeClasses[announcement.type || "info"] || typeClasses.info;

    return (
        <div
            className={`w-full border-b ${variant}`}
            role="status"
            aria-live="polite"
        >
            <div className="container mx-auto px-4 py-2 flex items-center gap-3">
                <Megaphone className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0 text-sm">
                    <span className="font-semibold">{announcement.title}</span>
                    {announcement.content && (
                        <>
                            {" · "}
                            <span className="truncate opacity-90">{announcement.content}</span>
                        </>
                    )}
                </div>
                <button
                    type="button"
                    onClick={dismiss}
                    className="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                    aria-label="Dismiss announcement"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
