"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useModalDialog } from "@/core/sdk/ui";
import { safeUrl } from "../lib/safe-url";

interface ActivePopup {
    id: string;
    title: string;
    content: string | null;
    image?: string | null;
    link?: string | null;
    linkText?: string | null;
}

/**
 * Slot renderer for popups. Mounts on every public page via the
 * `layout.overlay` slot and fetches the currently active popup from
 * the module's public API. Dismissal state is persisted in localStorage
 * per popup id so users don't see the same popup twice.
 *
 * Rendering no-ops when the popups module is not installed - the slot
 * registry simply doesn't contain this entry in that case.
 */
export default function PopupRenderer() {
    const t = useTranslations("popups");
    const [popup, setPopup] = useState<ActivePopup | null>(null);

    useEffect(() => {
        let active = true;
        fetch("/api/v1/popups?active=1&limit=1")
            .then((r) => (r.ok ? r.json() : { popups: [] }))
            .then((d: { popups?: ActivePopup[] }) => {
                if (!active) return;
                const first = (d.popups || [])[0];
                if (!first) return;
                if (typeof window !== "undefined") {
                    const dismissed = localStorage.getItem(`popup-dismissed:${first.id}`);
                    if (dismissed) return;
                }
                setPopup(first);
            })
            .catch(() => undefined);
        return () => { active = false; };
    }, []);

    const dismiss = useCallback(() => {
        if (!popup) return;
        if (typeof window !== "undefined") {
            localStorage.setItem(`popup-dismissed:${popup.id}`, "1");
        }
        setPopup(null);
    }, [popup]);

    // A modal that only closes by clicking its backdrop cannot be closed with a
    // keyboard at all, and one that does not trap Tab leaves the page behind it
    // reachable under the scrim.
    const dialogRef = useModalDialog<HTMLDivElement>(popup !== null, dismiss);

    if (!popup) return null;

    const image = safeUrl(popup.image, false);
    const link = safeUrl(popup.link, true);

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" role="presentation">
            <div className="fixed inset-0 bg-black/50" onClick={dismiss} aria-hidden="true" />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="popup-title"
                className="relative bg-card rounded-lg shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto"
            >
                {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="w-full h-auto rounded-t-lg" />
                )}
                <div className="p-5">
                    <h2 id="popup-title" className="text-lg font-semibold mb-2">{popup.title}</h2>
                    {popup.content && (
                        <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">{popup.content}</p>
                    )}
                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={dismiss}
                            className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5"
                        >
                            {t("close")}
                        </button>
                        {link && (
                            <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded hover:opacity-90"
                                onClick={dismiss}
                            >
                                {popup.linkText || t("learnMore")}
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
