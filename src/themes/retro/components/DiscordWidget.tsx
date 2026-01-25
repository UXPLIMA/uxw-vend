
"use client";

import { serverConfig } from "@/core/config/server";

export default function RetroDiscordWidget() {
    if (!serverConfig.discordWidgetId) return null;

    return (
        <div className="bg-indigo-900 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 relative overflow-hidden">
            {/* Retro Header */}
            <div className="absolute top-0 left-0 w-full bg-black text-white text-xs font-mono p-1 text-center">
                COMM_LINK_ESTABLISHED
            </div>

            <div className="mt-6 border-2 border-indigo-500 p-1 bg-indigo-950">
                <iframe
                    src={`https://discord.com/widget?id=${serverConfig.discordWidgetId}&theme=dark`}
                    width="100%"
                    height="300"
                    frameBorder="0"
                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                />
            </div>

            <div className="mt-2 text-center">
                <button className="bg-indigo-500 text-white font-mono text-xs px-4 py-2 border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1">
                    JOIN_SERVER //
                </button>
            </div>
        </div>
    );
}
