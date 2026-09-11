"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpCircle, X } from "lucide-react";

interface Props {
    count: number;
    children?: React.ReactNode;
}

const STORAGE_KEY = "blysis.admin.updateBanner.dismissedFor";

/**
 * Client wrapper that owns the dismiss state for the admin update banner.
 * A dismissal is remembered per-count - when the number of available updates
 * changes the banner reappears, nudging the admin to take another look.
 */
export function UpdateBannerDismiss({ count, children }: Props) {
    const t = useTranslations("admin");
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw && parseInt(raw, 10) === count) {
                setDismissed(true);
            } else {
                setDismissed(false);
            }
        } catch { /* localStorage unavailable - show banner */ }
    }, [count]);

    if (dismissed) return null;

    const dismiss = () => {
        try {
            localStorage.setItem(STORAGE_KEY, String(count));
        } catch { /* ignore */ }
        setDismissed(true);
    };

    return (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            <div className="flex items-center gap-2.5 min-w-0">
                <ArrowUpCircle className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">
                    <strong>{count}</strong> module update{count === 1 ? "" : "s"} available
                </span>
                <span className="text-warning">·</span>
                {children}
            </div>
            <button
                type="button"
                onClick={dismiss}
                aria-label={t("updates_dismiss")}
                className="flex-shrink-0 rounded p-1 text-warning hover:bg-warning/20"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
