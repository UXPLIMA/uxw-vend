"use client";

import { useState } from "react";
import { useThemeConfig } from "@/core/lib/theme-config-client";
import { Slot } from "@/core/components/Slot";
import { Copy, Check, Server } from "lucide-react";

/**
 * PixelCraft hero — gaming / Minecraft-oriented landing banner.
 *
 * Reads its content from the theme's own admin-configurable settings
 * (see `settings.hero` in theme.json). Nothing is hardcoded to a
 * specific server or brand; if a field is blank the hero degrades
 * gracefully.
 *
 * The live-stats strip is populated by whichever module contributes
 * to the `hero.liveStats` slot (typically `mc-stats`). If no module
 * fills it, the strip simply stays empty — keeping theme independent
 * of any particular feature module.
 */
export default function Hero() {
    const config = useThemeConfig() as { hero?: Record<string, unknown> };
    const hero = config?.hero ?? {};
    const title = (hero.title as string) || "Sunucuya Hoşgeldin";
    const subtitle = (hero.subtitle as string) || "";
    const bgImage = (hero.backgroundImage as string) || "";
    const serverIp = (hero.serverIp as string) || "";
    const ctaText = (hero.ctaText as string) || "";
    const ctaHref = (hero.ctaHref as string) || "";
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
            className="relative min-h-[60vh] flex items-center justify-center overflow-hidden"
            style={{
                background: bgImage
                    ? `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65)), url(${bgImage}) center/cover no-repeat`
                    : "linear-gradient(135deg, var(--uxw-color-background) 0%, var(--uxw-color-muted) 100%)",
                color: "var(--uxw-color-foreground)",
            }}
        >
            <div className="relative z-10 max-w-4xl w-full text-center px-4 py-16 md:py-24 space-y-6">
                <h1
                    className="text-3xl md:text-5xl lg:text-6xl leading-tight tracking-tight"
                    style={{ fontFamily: "var(--uxw-font-heading)" }}
                >
                    {title}
                </h1>

                {subtitle && (
                    <p className="text-base md:text-lg opacity-90 max-w-2xl mx-auto">
                        {subtitle}
                    </p>
                )}

                {serverIp && (
                    <div className="inline-flex items-center gap-2 rounded-md border bg-[rgba(0,0,0,0.4)] px-4 py-2 font-mono text-sm backdrop-blur"
                         style={{ borderColor: "var(--uxw-color-border)" }}>
                        <Server size={16} />
                        <span>{serverIp}</span>
                        <button
                            type="button"
                            onClick={copyIp}
                            className="ml-2 p-1 rounded hover:bg-[rgba(255,255,255,0.1)] transition"
                            aria-label="Copy server IP"
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                    </div>
                )}

                <Slot name="hero.liveStats" />

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    {ctaText && ctaHref && (
                        <a
                            href={ctaHref}
                            className="inline-flex items-center px-6 py-3 rounded-md font-semibold text-sm transition hover:opacity-90"
                            style={{
                                background: "var(--uxw-color-primary)",
                                color: "var(--uxw-color-primaryForeground)",
                            }}
                        >
                            {ctaText}
                        </a>
                    )}
                    {discordUrl && (
                        <a
                            href={discordUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-6 py-3 rounded-md font-semibold text-sm transition hover:opacity-90"
                            style={{
                                background: "#5865F2",
                                color: "#ffffff",
                            }}
                        >
                            Discord
                        </a>
                    )}
                </div>
            </div>
        </section>
    );
}
