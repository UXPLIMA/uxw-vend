"use client";

import { serverConfig } from "@/core/config/server";

export default function MinecraftDiscordWidget() {
    if (!serverConfig.discordWidgetId) return null;

    return (
        <div className="overflow-hidden" style={{ background: "#242424", border: "1px solid #3a3a3a", borderRadius: "2px" }}>
            <div className="p-3 flex items-center gap-2" style={{ background: "#5865F2", borderBottom: "3px solid #4752c4" }}>
                <span className="text-white font-bold text-sm uppercase tracking-wider" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}>Discord</span>
            </div>
            <iframe
                src={`https://discord.com/widget?id=${serverConfig.discordWidgetId}&theme=dark`}
                width="100%"
                height="280"
                frameBorder="0"
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            />
        </div>
    );
}
