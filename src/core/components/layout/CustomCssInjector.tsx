"use client";

import { useEffect, useState } from "react";

export function CustomCssInjector() {
    const [css, setCss] = useState("");

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((data) => {
                const customCss = data.settings?.custom_css;
                if (typeof customCss === "string" && customCss.trim()) {
                    setCss(customCss);
                }
            })
            .catch(() => {});
    }, []);

    if (!css) return null;

    return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
