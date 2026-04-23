"use client";

import { useState } from "react";
import { useThemeConfig } from "@/core/lib/theme-config-client";
import { Slot } from "@/core/components/Slot";
import { Copy, Check, Gamepad2 } from "lucide-react";

/**
 * PixelCraft hero — three-column gaming banner.
 *
 *   [ server IP cell ]  [ center logo ]  [ discord cell ]
 *
 * Each side cell exposes a `<Slot />` above its label so an analytics
 * module (typically mc-stats) can inject a live counter — "24 448
 * PLAYERS ONLINE", "950 MEMBERS ONLINE" — without the theme knowing
 * about the module. If nothing fills the slot, the cell degrades to
 * just the static label.
 *
 * The center column shows the admin-uploaded logo (hero.logoImage).
 * If no logo is set, the column collapses so the two info cells
 * stretch evenly.
 */
export default function Hero() {
    // useThemeConfig returns a dotted-path getter, not the raw object —
    // don't cast it to a record.
    const get = useThemeConfig();
    const bgImage = get<string>("hero.backgroundImage", "") ?? "";
    const logoImage = get<string>("hero.logoImage", "") ?? "";
    const serverIp = get<string>("hero.serverIp", "") ?? "";
    const discordUrl = get<string>("hero.discordUrl", "") ?? "";

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
                color: "#f8f8f8",
            }}
        >
            <div className="max-w-7xl mx-auto px-4 py-10 md:py-16">
                <div className="grid grid-cols-3 items-center gap-4">
                    {/* Left: server IP */}
                    <div className="justify-self-start">
                        {serverIp ? (
                            <button
                                type="button"
                                onClick={copyIp}
                                className="group flex items-center gap-3 text-left hover:opacity-90 transition"
                                aria-label="Copy server IP"
                            >
                                <Gamepad2 className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0 drop-shadow" style={{ color: "var(--uxw-color-primary)" }} />
                                <div className="min-w-0">
                                    <div className="text-[10px] md:text-xs uppercase tracking-wider opacity-85">
                                        <Slot name="hero.liveStats" />
                                    </div>
                                    <div className="flex items-center gap-1.5 font-bold text-base md:text-lg font-mono drop-shadow">
                                        <span className="truncate">{serverIp}</span>
                                        {copied ? <Check size={14} /> : <Copy size={14} className="opacity-60 group-hover:opacity-100" />}
                                    </div>
                                </div>
                            </button>
                        ) : null}
                    </div>

                    {/* Center: logo */}
                    <div className="justify-self-center">
                        {logoImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={logoImage}
                                alt="logo"
                                className="h-20 md:h-32 max-w-[260px] object-contain drop-shadow-lg"
                            />
                        ) : null}
                    </div>

                    {/* Right: Discord */}
                    <div className="justify-self-end">
                        {discordUrl ? (
                            <a
                                href={discordUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-3 hover:opacity-90 transition"
                            >
                                <div className="min-w-0 text-right">
                                    <div className="text-[10px] md:text-xs uppercase tracking-wider opacity-85">
                                        <Slot name="hero.discordStats" />
                                    </div>
                                    <div className="font-bold text-base md:text-lg uppercase tracking-wide drop-shadow">
                                        Discord
                                    </div>
                                </div>
                                <DiscordMark className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0 drop-shadow" />
                            </a>
                        ) : null}
                    </div>
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
