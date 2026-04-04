"use client";

import { serverConfig } from "@/core/config/server";
import { useState, useEffect } from "react";
import { useModuleEnabled } from "@/core/hooks/useModule";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";

export function DiscordWidget() {
    const { enabled: discordEnabled } = useModuleEnabled('discord-widget');
    const { settings } = useSiteSettings();
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        setIsDark(document.documentElement.hasAttribute("data-mode"));
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.hasAttribute("data-mode"));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
        return () => observer.disconnect();
    }, []);

    const widgetId = (settings.widget_discord_server_id as string) || serverConfig.discordWidgetId;
    if (!discordEnabled || !widgetId) return null;

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <iframe
                src={`https://discord.com/widget?id=${widgetId}&theme=${isDark ? "dark" : "light"}`}
                width="100%"
                height="300"
                frameBorder="0"
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                className="rounded-xl"
            />
        </div>
    );
}
