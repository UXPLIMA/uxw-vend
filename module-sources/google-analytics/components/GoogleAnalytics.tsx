"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

export function GoogleAnalytics() {
    const [gaId, setGaId] = useState<string | null>(null);

    useEffect(() => {
        // Only load if cookies accepted
        const consent = localStorage.getItem("cookie_consent");
        if (consent !== "accepted") return;

        // Get GA ID from settings or env
        const envId = process.env.NEXT_PUBLIC_GA_ID;
        if (envId) {
            setGaId(envId); // eslint-disable-line react-hooks/set-state-in-effect
            return;
        }

        // Try fetching from settings API
        fetch("/api/v1/public-settings")
            .then((r) => r.json())
            .then((d) => {
                const id = d.settings?.google_analytics_id;
                if (id && typeof id === "string") setGaId(id);
            })
            .catch(() => {});
    }, []);

    if (!gaId) return null;

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${gaId}');
                `}
            </Script>
        </>
    );
}
