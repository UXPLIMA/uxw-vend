"use client";

import { useEffect, useState } from "react";

export function CustomCssInjector() {
    const [css, setCss] = useState("");

    useEffect(() => {
        fetch("/api/v1/public-settings")
            .then((r) => r.json())
            .then((data) => {
                const s = data.settings || {};

                // Custom CSS
                const customCss = s.custom_css;
                if (typeof customCss === "string" && customCss.trim()) {
                    // Sanitize: remove script injection attempts, @import, expressions, and other XSS vectors
                    const sanitized = customCss
                        .replace(/<\/?script[^>]*>/gi, "")
                        .replace(/javascript\s*:/gi, "")
                        .replace(/expression\s*\(/gi, "")
                        .replace(/@import\s/gi, "/* blocked import */")
                        .replace(/url\s*\(\s*['"]?\s*javascript/gi, "url(blocked")
                        .replace(/behavior\s*:/gi, "/* blocked behavior */")
                        .replace(/-moz-binding\s*:/gi, "/* blocked moz-binding */")
                        .replace(/@charset\s/gi, "/* blocked charset */");
                    setCss(sanitized);
                }

                // Apply saved theme colors
                const colorKeys = ["primary", "secondary", "accent", "background", "foreground", "card", "muted", "muted-foreground", "destructive", "success", "warning"];
                colorKeys.forEach((key) => {
                    const dbKey = `theme_color_${key.replace("-", "_")}`;
                    const value = s[dbKey];
                    if (typeof value === "string" && value.startsWith("#")) {
                        document.documentElement.style.setProperty(`--color-${key}`, value);
                    }
                });
            })
            .catch(() => {});
    }, []);

    if (!css) return null;

    return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
