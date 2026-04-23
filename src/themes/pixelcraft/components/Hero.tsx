"use client";

import { useState } from "react";
import { useThemeConfig } from "@/core/lib/theme-config-client";
import { Slot } from "@/core/components/Slot";
import { Copy, Check, Gamepad2 } from "lucide-react";

/**
 * PixelCraft hero — compact horizontal banner, Hypixel-style.
 *
 * Two info cells flank a background image: server IP on the left, the
 * Discord community link on the right. Both cells expose a `<Slot />`
 * above their label so an analytics module (typically mc-stats) can
 * inject a live counter — "24 448 PLAYERS ONLINE", "950 MEMBERS ONLINE"
 * — without the theme knowing about the module. If nothing fills the
 * slot, the cell degrades to just the static label.
 *
 * The hero deliberately stays short (~120 px) so the navbar and first
 * fold content stay visible without scrolling.
 */
export default function Hero() {
    const config = useThemeConfig() as { hero?: Record<string, unknown> };
    const hero = config?.hero ?? {};
    const bgImage = (hero.backgroundImage as string) || "";
    const serverIp = (hero.serverIp as string) || "";
    const discordUrl = (hero.discordUrl as string) || "";

    const [copied, setCopied] = useState(false);
    const copyIp = async () => {
        if (!serverIp) return;
        try {
            await navigator.clipboard.writeText(serverIp);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard unavailable — ignore */ }
    };

    return (
        <section
            className="relative overflow-hidden"
            style={{
                background: bgImage
                    ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${bgImage}) center/cover no-repeat`
                    : "linear-gradient(135deg, var(--uxw-color-muted) 0%, var(--uxw-color-card) 100%)",
                color: "var(--uxw-color-foreground)",
            }}
        >
            <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
                <div className="flex items-center justify-between gap-4">
                    {/* Left: server info — Minecraft IP */}
                    {serverIp ? (
                        <button
                            type="button"
                            onClick={copyIp}
                            className="group flex items-center gap-3 text-left hover:opacity-90 transition"
                            aria-label="Copy server IP"
                        >
                            <Gamepad2 className="w-6 h-6 md:w-7 md:h-7 flex-shrink-0" style={{ color: "var(--uxw-color-primary)" }} />
                            <div className="min-w-0">
                                <div className="text-[10px] md:text-xs uppercase tracking-wider opacity-80">
                                    <Slot name="hero.liveStats" />
                                </div>
                                <div className="flex items-center gap-1.5 font-bold text-sm md:text-base font-mono">
                                    <span className="truncate">{serverIp}</span>
                                    {copied ? <Check size={12} /> : <Copy size={12} className="opacity-60 group-hover:opacity-100" />}
                                </div>
                            </div>
                        </button>
                    ) : (
                        <div />
                    )}

                    {/* Right: Discord */}
                    {discordUrl ? (
                        <a
                            href={discordUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-3 hover:opacity-90 transition"
                        >
                            <div className="min-w-0 text-right">
                                <div className="text-[10px] md:text-xs uppercase tracking-wider opacity-80">
                                    <Slot name="hero.discordStats" />
                                </div>
                                <div className="font-bold text-sm md:text-base uppercase tracking-wide">
                                    Discord
                                </div>
                            </div>
                            <DiscordMark className="w-6 h-6 md:w-7 md:h-7 flex-shrink-0" />
                        </a>
                    ) : (
                        <div />
                    )}
                </div>
            </div>
        </section>
    );
}

function DiscordMark({ className }: { className?: string }) {
    // Inline SVG so we avoid an external asset request + stay monochromatic
    // against any background the admin picks.
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" style={{ color: "#5865F2" }} aria-hidden="true">
            <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
    );
}
