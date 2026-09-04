"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

/**
 * Loads gtag once the visitor has accepted cookies and an admin has entered a
 * measurement ID.
 *
 * The ID comes from this module's own public endpoint. It used to be read from
 * `/api/v1/public-settings`, which publishes core's settings and has never
 * carried `google_analytics_id`, so the value was always undefined and the
 * script never loaded however carefully the ID was typed in. There was also a
 * `NEXT_PUBLIC_GA_ID` path, and a `NEXT_PUBLIC_` variable is frozen into the
 * bundle at build time - an install running the prebuilt image cannot set one,
 * so that path could never fire either.
 */
export function GoogleAnalytics() {
    const [gaId, setGaId] = useState<string | null>(null);

    useEffect(() => {
        // Tracking is what the cookie banner is asking about, so it waits.
        if (localStorage.getItem("cookie_consent") !== "accepted") return;

        let cancelled = false;
        fetch("/api/v1/google-analytics/config")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (cancelled || !d?.enabled) return;
                const id = d.measurementId;
                if (typeof id === "string" && id) setGaId(id);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    if (!gaId) return null;

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', ${JSON.stringify(gaId)});
                `}
            </Script>
        </>
    );
}
