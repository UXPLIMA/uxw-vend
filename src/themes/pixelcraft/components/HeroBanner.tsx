"use client";

import { Users } from "lucide-react";
import { serverConfig } from "@/core/config/server";
import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { useState } from "react";

export default function PixelCraftHeroBanner() {
    const t = useTranslations('hero');
    const { settings } = useSiteSettings();
    const [copied, setCopied] = useState(false);

    const bgImage = (settings.hero_background_image as string) || "/background1.png";
    const logoImage = (settings.hero_logo_image as string) || "/logo.png";
    const logoUrl = (settings.hero_logo_url as string) || "";
    const serverIp = (settings.hero_server_ip as string) || serverConfig.ip;
    const discordUrl = (settings.hero_discord_url as string) || serverConfig.communityUrl;

    const copyIp = () => { navigator.clipboard.writeText(serverIp); setCopied(true); setTimeout(() => setCopied(false), 2000); };

    return (
        <div className="relative overflow-hidden" style={{ height: 340, background: "#111" }}>
            {/* Background */}
            <div className="absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bgImage} alt="" className="w-full h-full object-cover opacity-40" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(17,17,17,0.3) 0%, rgba(17,17,17,0.8) 70%, #1a1a1a 100%)" }} />
            </div>

            {/* Floating particles effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="absolute w-1 h-1 rounded-none animate-float" style={{
                        background: "#ffb800",
                        opacity: 0.4,
                        left: `${15 + i * 15}%`,
                        top: `${20 + (i % 3) * 25}%`,
                        animationDelay: `${i * 0.8}s`,
                        animationDuration: `${3 + i * 0.5}s`,
                    }} />
                ))}
            </div>

            <div className="relative container mx-auto px-4 h-full z-10 flex flex-col items-center justify-center text-center">
                {/* Logo */}
                {logoUrl ? (
                    logoUrl.startsWith("http") ? (
                        <a href={logoUrl} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logoImage} alt={serverConfig.name} className="h-28 md:h-36 w-auto object-contain mb-6 cursor-pointer hover:scale-105 transition-transform" style={{ imageRendering: "auto", filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.5))" }} />
                        </a>
                    ) : (
                        <Link href={logoUrl}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logoImage} alt={serverConfig.name} className="h-28 md:h-36 w-auto object-contain mb-6 cursor-pointer hover:scale-105 transition-transform" style={{ imageRendering: "auto", filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.5))" }} />
                        </Link>
                    )
                ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={logoImage} alt={serverConfig.name} className="h-28 md:h-36 w-auto object-contain mb-6" style={{ imageRendering: "auto", filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.5))" }} />
                )}

                {/* CTA Buttons */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={copyIp}
                        className="px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all"
                        style={{
                            background: "linear-gradient(180deg, #5dbd4a 0%, #3ea72d 100%)",
                            color: "#fff",
                            border: "none",
                            borderBottom: "4px solid #2d7a20",
                            borderRadius: "2px",
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: "10px",
                        }}
                    >
                        <span className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            {copied ? "IP COPIED!" : serverIp.toUpperCase()}
                        </span>
                    </button>

                    <Link href={discordUrl} target="_blank"
                        className="px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all inline-block"
                        style={{
                            background: "linear-gradient(180deg, #7289da 0%, #5865F2 100%)",
                            color: "#fff",
                            border: "none",
                            borderBottom: "4px solid #4752c4",
                            borderRadius: "2px",
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: "10px",
                        }}
                    >
                        DISCORD
                    </Link>
                </div>

                {/* Player count */}
                <div className="mt-4 flex items-center gap-2 text-sm" style={{ color: "#8c8c8c" }}>
                    <span className="w-2 h-2 rounded-none animate-pulse" style={{ background: "#3ea72d" }} />
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px" }}>
                        {t('playersOnline', { count: serverConfig.onlineCount })}
                    </span>
                </div>
            </div>
        </div>
    );
}
