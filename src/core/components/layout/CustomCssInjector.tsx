"use client";

import { useEffect, useState } from "react";

export function CustomCssInjector() {
    const [css, setCss] = useState("");

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((data) => {
                const s = data.settings || {};

                // Custom CSS
                const customCss = s.custom_css;
                if (typeof customCss === "string" && customCss.trim()) {
                    setCss(customCss);
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
