"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/core/components/ui/button";
import { X } from "lucide-react";

interface PopupData {
    id: string;
    title: string;
    content: string | null;
    image: string | null;
    link: string | null;
    linkText: string | null;
}

export function PopupModal() {
    const [popup, setPopup] = useState<PopupData | null>(null);

    useEffect(() => {
        // Check if already dismissed this session
        const dismissed = sessionStorage.getItem("popup_dismissed");
        if (dismissed) return;

        fetch("/api/v1/popups")
            .then((r) => r.json())
            .then((d) => {
                const popups = d.popups || [];
                if (popups.length > 0) setPopup(popups[0]);
            })
            .catch(() => {});
    }, []);

    const dismiss = () => {
        sessionStorage.setItem("popup_dismissed", "true");
        setPopup(null);
    };

    if (!popup) return null;

    // Validate URLs to prevent XSS via javascript: or data: URIs
    const safeImage = popup.image?.startsWith('https://') ? popup.image : null;
    const safeLink = popup.link && (popup.link.startsWith('https://') || popup.link.startsWith('http://')) ? popup.link : null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={dismiss} />
            <div className="relative bg-card rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                <button
                    onClick={dismiss}
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow"
                >
                    <X className="w-4 h-4" />
                </button>

                {safeImage && (
                    <Image src={safeImage} alt={popup.title} width={0} height={0} sizes="100vw" className="w-full h-48 object-cover" />
                )}

                <div className="p-6">
                    <h2 className="text-xl font-bold text-foreground mb-2">{popup.title}</h2>
                    {popup.content && (
                        <p className="text-sm text-muted-foreground mb-4">{popup.content}</p>
                    )}
                    <div className="flex gap-3">
                        {safeLink && (
                            <a href={safeLink} target="_blank" rel="noopener noreferrer">
                                <Button>{popup.linkText || "Learn More"}</Button>
                            </a>
                        )}
                        <Button variant="outline" onClick={dismiss}>Close</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
