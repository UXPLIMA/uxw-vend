"use client";

import { serverConfig } from "@/core/config/server";
import { useState, useEffect } from "react";

export function DiscordWidget() {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        setIsDark(document.documentElement.hasAttribute("data-mode"));
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.hasAttribute("data-mode"));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
        return () => observer.disconnect();
    }, []);

    if (!serverConfig.discordWidgetId) return null;

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <iframe
                src={`https://discord.com/widget?id=${serverConfig.discordWidgetId}&theme=${isDark ? "dark" : "light"}`}
                width="100%"
                height="300"
                frameBorder="0"
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                className="rounded-xl"
            />
        </div>
    );
}
