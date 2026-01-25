
"use client";

import { serverConfig } from "@/core/config/server";

export function DiscordWidget() {
    if (!serverConfig.discordWidgetId) return null;

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <iframe
                src={`https://discord.com/widget?id=${serverConfig.discordWidgetId}&theme=light`}
                width="100%"
                height="300"
                frameBorder="0"
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                className="rounded-xl"
            />
        </div>
    );
}
