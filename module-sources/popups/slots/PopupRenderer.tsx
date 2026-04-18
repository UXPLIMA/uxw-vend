"use client";

import { useEffect, useState } from "react";

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
 * Rendering no-ops when the popups module is not installed — the slot
 * registry simply doesn't contain this entry in that case.
 */
export default function PopupRenderer() {
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

    if (!popup) return null;

    const dismiss = () => {
        if (typeof window !== "undefined") {
            localStorage.setItem(`popup-dismissed:${popup.id}`, "1");
        }
        setPopup(null);
    };

    return (
        <div
            className="fixed inset-0 z-[9998] bg-black/50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="popup-title"
            onClick={dismiss}
        >
            <div
                className="bg-card rounded-lg shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {popup.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={popup.image} alt="" className="w-full h-auto rounded-t-lg" />
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
                            Dismiss
                        </button>
                        {popup.link && popup.linkText && (
                            <a
                                href={popup.link}
                                className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded hover:opacity-90"
                                onClick={dismiss}
                            >
                                {popup.linkText}
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
