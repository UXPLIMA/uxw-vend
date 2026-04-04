"use client";

import { useState, useEffect } from "react";

let cachedSettings: Record<string, unknown> | null = null;
let fetchPromise: Promise<Record<string, unknown>> | null = null;

async function fetchSettings(): Promise<Record<string, unknown>> {
    if (cachedSettings) return cachedSettings;
    if (fetchPromise) return fetchPromise;

    fetchPromise = fetch("/api/v1/public-settings")
        .then((r) => {
            if (!r.ok) throw new Error(`Settings fetch failed: ${r.status}`);
            return r.json();
        })
        .then((d) => {
            cachedSettings = d.settings || {};
            setTimeout(() => { cachedSettings = null; fetchPromise = null; }, 60000);
            return cachedSettings!;
        })
        .catch((err) => {
            console.error("[useSiteSettings]", err);
            fetchPromise = null;
            return {};
        });

    return fetchPromise;
}

export function useSiteSettings() {
    const [settings, setSettings] = useState<Record<string, unknown>>(cachedSettings || {});
    const [loaded, setLoaded] = useState(!!cachedSettings);

    useEffect(() => {
        fetchSettings().then((s) => {
            setSettings(s);
            setLoaded(true);
        });
    }, []);

    return { settings, loaded };
}
