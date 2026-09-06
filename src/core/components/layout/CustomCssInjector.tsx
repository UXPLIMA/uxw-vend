"use client";

import { useEffect, useState } from "react";
import { sanitizeCustomCss } from "@/core/lib/css-sanitizer";
import { sharedJson } from "@/core/lib/shared-request";

export function CustomCssInjector() {
    const [css, setCss] = useState("");

    useEffect(() => {
        // Shared with the navbar, the footer and the currency selector, which
        // all want the same payload: one request serves every one of them.
        sharedJson<{ settings?: Record<string, unknown> }>("/api/v1/public-settings")
            .then((data) => {
                const s = data.settings || {};

                const customCss = s.custom_css;
                if (typeof customCss === "string" && customCss.trim()) {
                    // Values are already sanitized at write time in the
                    // settings route; we sanitize again here as defense-in-depth
                    // in case an older pre-sanitization value is still in the DB.
                    setCss(sanitizeCustomCss(customCss));
                }

                const colorKeys = ["primary", "secondary", "accent", "background", "foreground", "card", "muted", "muted-foreground", "destructive", "success", "warning"];
                colorKeys.forEach((key) => {
                    const dbKey = `theme_color_${key.replace("-", "_")}`;
                    const value = s[dbKey];
                    if (typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value)) {
                        document.documentElement.style.setProperty(`--color-${key}`, value);
                    }
                });
            })
            .catch(() => {});
    }, []);

    if (!css) return null;

    // Rendering as a text child (not dangerouslySetInnerHTML) means React
    // escapes angle brackets into entities. Combined with sanitizeCustomCss
    // stripping them at the source, there is no path for a `</style>`
    // break-out even if sanitization is bypassed somehow.
    return <style>{css}</style>;
}
