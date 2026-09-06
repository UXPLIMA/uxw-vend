"use client";

import { useState, useEffect } from "react";
import { sharedJson, peekShared, invalidateShared } from "@/core/lib/shared-request";

/**
 * Public site settings, fetched once per page however many components ask.
 *
 * The deduplication used to live in a module-level variable here, which held
 * until code splitting put a second copy of this file on the homepage. Each
 * copy had its own "in flight" variable, so the navbar, the footer, the
 * currency selector and the homepage between them fetched the same settings
 * five times. The shared store hangs off `globalThis`, so every copy finds
 * the same entry.
 */
const SETTINGS_URL = "/api/v1/public-settings";

interface SettingsPayload {
    settings?: Record<string, unknown>;
    cacheSeconds?: number;
}

/**
 * The server states how long it considers the payload fresh
 * (Admin > Settings > General). A minute when it says nothing.
 */
function freshness(payload: SettingsPayload): number {
    const seconds = payload.cacheSeconds;
    return typeof seconds === "number" && seconds > 0 ? seconds * 1000 : 60_000;
}

/** Invalidate the settings cache so the next useSiteSettings call fetches fresh data */
export function invalidateSettingsCache() {
    invalidateShared(SETTINGS_URL);
}

export function useSiteSettings() {
    // Render what is already known on the first pass. Waiting a tick for a
    // value we are holding costs a blank frame, and the footer moving after
    // that frame is what a visitor sees as the page jumping.
    const known = peekShared<SettingsPayload>(SETTINGS_URL);
    const [settings, setSettings] = useState<Record<string, unknown>>(known?.settings ?? {});
    const [loaded, setLoaded] = useState(known !== undefined);

    useEffect(() => {
        sharedJson<SettingsPayload>(SETTINGS_URL, freshness)
            .then((payload) => {
                setSettings(payload.settings || {});
                setLoaded(true);
            })
            .catch((err) => {
                console.error("[useSiteSettings]", err);
            });
    }, []);

    return { settings, loaded };
}
