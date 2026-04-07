"use client";

import { useSiteSettings } from "@/core/hooks/useSiteSettings";

export default function PixelCraftDiscordWidget() {
    const { settings } = useSiteSettings();
    const widgetId = (settings.widget_discord_server_id as string) || "";
    if (!widgetId) return null;

    return (
        <div className="overflow-hidden" style={{ background: "#242424", border: "1px solid #3a3a3a", borderRadius: "2px" }}>
            <div className="p-3 flex items-center gap-2" style={{ background: "#5865F2", borderBottom: "3px solid #4752c4" }}>
                <span className="text-white font-bold text-sm uppercase tracking-wider" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}>Discord</span>
            </div>
            <iframe
                src={`https://discord.com/widget?id=${widgetId}&theme=dark`}
                width="100%"
                height="280"
                frameBorder="0"
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            />
        </div>
    );
}
