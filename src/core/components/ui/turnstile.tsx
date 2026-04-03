"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

interface TurnstileProps {
    onVerify: (token: string) => void;
}

export function Turnstile({ onVerify }: TurnstileProps) {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const containerRef = useRef<HTMLDivElement>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!loaded || !containerRef.current || !siteKey) return;

        const win = window as any;
        if (win.turnstile) {
            win.turnstile.render(containerRef.current, {
                sitekey: siteKey,
                callback: onVerify,
                theme: "auto",
            });
        }
    }, [loaded, siteKey, onVerify]);

    if (!siteKey) return null;

    return (
        <>
            <Script
                src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                onLoad={() => setLoaded(true)}
            />
            <div ref={containerRef} />
        </>
    );
}
