"use client";

import React, { useEffect, useState } from "react";
import type { ComponentConfig } from "@measured/puck";
import { Info, AlertTriangle, CheckCircle, AlertCircle, X } from "lucide-react";

/**
 * Puck page-builder block: AnnouncementBanner
 * Renders the latest active announcement (optionally the pinned one) as
 * an inline banner. Intended for placement inside a custom page layout.
 */

interface AnnouncementBannerProps {
    style: "info" | "warning" | "success" | "error";
    dismissible: boolean;
}

interface Announcement {
    id: string;
    title: string;
    content: string;
    type: string;
    dismissible?: boolean;
    pinned?: boolean;
}

const styleConfig: Record<string, { Icon: typeof Info; color: string }> = {
    info: { Icon: Info, color: "var(--color-primary)" },
    warning: { Icon: AlertTriangle, color: "var(--color-warning)" },
    success: { Icon: CheckCircle, color: "var(--color-success)" },
    error: { Icon: AlertCircle, color: "var(--color-destructive)" },
};

function AnnouncementBannerBlockRender({ style, dismissible }: AnnouncementBannerProps): React.ReactElement {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/v1/announcements`)
            .then((r) => r.json())
            .then((d) => {
                if (cancelled) return;
                const list: Announcement[] = Array.isArray(d) ? d : d.announcements || d.data || [];
                const pinned = list.find((a) => a.pinned);
                setAnnouncement(pinned || list[0] || null);
            })
            .catch(() => {});

        return () => { cancelled = true; };
    }, []);

    if (!announcement || dismissed) return <></>;

    const config = styleConfig[style] || styleConfig.info;
    const Icon = config.Icon;

    return (
        <div
            className="px-4 py-2.5 my-2 rounded-md"
            style={{
                backgroundColor: "var(--color-card)",
                borderLeft: `3px solid ${config.color}`,
            }}
        >
            <div className="container mx-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
                    <div className="min-w-0">
                        <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                            {announcement.title}
                        </span>
                        {announcement.content && announcement.content !== announcement.title ? (
                            <span className="text-sm ml-2" style={{ color: "var(--color-muted-foreground)" }}>
                                {announcement.content}
                            </span>
                        ) : null}
                    </div>
                </div>
                {dismissible ? (
                    <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        className="flex-shrink-0 p-1 rounded transition-opacity opacity-50 hover:opacity-100"
                        aria-label="Dismiss announcement"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                ) : null}
            </div>
        </div>
    );
}

const AnnouncementBannerBlock: ComponentConfig<AnnouncementBannerProps> = {
    fields: {
        style: {
            type: "select",
            label: "Style",
            options: [
                { label: "Info", value: "info" },
                { label: "Warning", value: "warning" },
                { label: "Success", value: "success" },
                { label: "Error", value: "error" },
            ],
        },
        dismissible: {
            type: "radio",
            label: "Dismissible",
            options: [
                { label: "Yes", value: true },
                { label: "No", value: false },
            ],
        },
    },
    defaultProps: {
        style: "info",
        dismissible: true,
    },
    render: AnnouncementBannerBlockRender,
};

export default AnnouncementBannerBlock;
