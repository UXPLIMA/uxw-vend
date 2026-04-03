"use client";

import { Crown, Users, Copy } from "lucide-react";
import { serverConfig } from "@/core/config/server";
import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { useState } from "react";

export function HeroBanner() {
    const t = useTranslations('hero');
    const { settings } = useSiteSettings();
    const [copied, setCopied] = useState(false);

    const bgImage = (settings.hero_background_image as string) || "/background1.jpg";
    const logoImage = (settings.hero_logo_image as string) || "/logo.png";
    const serverIp = (settings.hero_server_ip as string) || serverConfig.ip;
    const discordUrl = (settings.hero_discord_url as string) || serverConfig.discordUrl;
    const height = parseInt((settings.hero_height as string) || "300");

    const copyIp = () => {
        navigator.clipboard.writeText(serverIp);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative overflow-hidden" style={{ height }}>
            {/* Background */}
            <div className="absolute inset-0">
                <img src={bgImage} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#080c14]/60 via-[#080c14]/70 to-[#080c14]" />
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5" />
            </div>

            {/* Decorative glow orbs */}
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-secondary/10 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative container mx-auto px-4 h-full z-10">
                <div className="flex items-center justify-between h-full">
                    {/* Left: Server Status */}
                    <div className="group hidden md:flex items-center gap-4 glass-light px-5 py-3.5 rounded-xl cursor-pointer transition-all duration-300 hover:bg-white/8 hover:-translate-y-0.5" onClick={copyIp}>
                        <div className="w-11 h-11 rounded-lg bg-accent/10 text-accent flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                            <Users size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest font-semibold">
                                {serverIp.toUpperCase()}
                                <Copy className={`w-3 h-3 transition-all ${copied ? "text-accent" : "opacity-0 group-hover:opacity-50"}`} />
                            </div>
                            <div className="text-accent font-bold text-base flex items-center gap-2 mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(6,255,165,0.5)]" />
                                {copied ? "IP Copied!" : t('playersOnline', { count: serverConfig.onlineCount })}
                            </div>
                        </div>
                    </div>

                    {/* Center: Logo */}
                    <div className="animate-float">
                        <img src={logoImage} alt={serverConfig.name} className="h-36 md:h-44 w-auto object-contain drop-shadow-[0_0_30px_rgba(0,212,255,0.2)]" />
                    </div>

                    {/* Right: Discord */}
                    <Link href={discordUrl} target="_blank" className="group hidden md:flex items-center gap-4 glass-light px-5 py-3.5 rounded-xl transition-all duration-300 hover:bg-[#5865F2]/15 hover:-translate-y-0.5">
                        <div className="text-right">
                            <div className="text-muted-foreground text-xs uppercase tracking-widest font-semibold group-hover:text-[#5865F2]/80 transition-colors">{t('joinCommunity')}</div>
                            <div className="text-[#5865F2] font-bold text-base mt-0.5 group-hover:text-white transition-colors">{t('discordServer')}</div>
                        </div>
                        <div className="w-11 h-11 rounded-lg bg-[#5865F2]/15 text-[#5865F2] flex items-center justify-center group-hover:bg-[#5865F2] group-hover:text-white transition-all duration-300">
                            <Crown size={22} />
                        </div>
                    </Link>
                </div>
            </div>

            {/* Bottom edge glow */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        </div>
    );
}
