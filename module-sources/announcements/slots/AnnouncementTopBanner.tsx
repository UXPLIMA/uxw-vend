"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
    const t = useTranslations("announcements");
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

    // The theme's own colours. These were fixed palette values with a
    // `dark:` counterpart, and this site switches modes on
    // [data-mode="dark"], not on Tailwind's variant: the dark half never
    // fired, so a dark banner kept its dark blue text on a dark background.
    const typeClasses: Record<string, string> = {
        info: "bg-primary/10 text-primary border-primary/20",
        warning: "bg-warning/10 text-warning border-warning/20",
        success: "bg-success/10 text-success border-success/20",
        error: "bg-destructive/10 text-destructive border-destructive/20",
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
                    className="flex-shrink-0 p-1 rounded hover:bg-foreground/10"
                    aria-label={t("dismiss")}
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
