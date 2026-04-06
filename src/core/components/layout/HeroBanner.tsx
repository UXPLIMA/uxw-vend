"use client";

import { Crown, Users } from "lucide-react";
import { serverConfig } from "@/core/config/server";
import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { useState } from "react";
import Image from "next/image";

export function HeroBanner() {
    const t = useTranslations('hero');
    const { settings } = useSiteSettings();
    const [copied, setCopied] = useState(false);

    const bgImage = (settings.hero_background_image as string) || "/background1.png";
    const logoImage = (settings.hero_logo_image as string) || "/logo.png";
    const serverIp = (settings.hero_server_ip as string) || serverConfig.ip || "";
    const discordUrl = (settings.hero_discord_url as string) || serverConfig.discordUrl || "";
    const siteName = (settings.site_name as string) || serverConfig.name;
    const playerCount = serverConfig.onlineCount;
    const height = parseInt((settings.hero_height as string) || "260");

    const showServerIp = !!serverIp;
    const showDiscord = !!discordUrl;

    const copyIp = () => { navigator.clipboard.writeText(serverIp); setCopied(true); setTimeout(() => setCopied(false), 2000); };

    return (
        <div className="relative overflow-hidden bg-[#1a1f2e]" style={{ height }}>
            <div className="absolute inset-0">
                <Image src={bgImage} alt="" fill className="object-cover opacity-50" unoptimized priority />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1f2e] via-[#1a1f2e]/60 to-transparent" />
            </div>

            <div className="relative container mx-auto px-4 h-full z-10">
                <div className="flex items-center justify-center h-full relative">
                    {showServerIp && (
                        <div className="hidden md:flex items-center gap-3 glass-light px-4 py-3 rounded-lg cursor-pointer hover:bg-white/10 transition-colors absolute left-0" onClick={copyIp}>
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center">
                                <Users size={20} />
                            </div>
                            <div>
                                <div className="text-gray-400 text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5">
                                    {serverIp.toUpperCase()}
                                    {copied && <span className="text-green-400 text-[10px] normal-case">Copied!</span>}
                                </div>
                                {playerCount > 0 && (
                                    <div className="text-green-400 font-bold flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        {t('playersOnline', { count: playerCount })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="animate-float">
                        <Image src={logoImage} alt={siteName} width={200} height={160} className="h-32 md:h-40 w-auto object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]" unoptimized priority />
                    </div>

                    {showDiscord && (
                        <Link href={discordUrl} target="_blank" className="hidden md:flex items-center gap-3 glass-light px-4 py-3 rounded-lg hover:bg-[#5865F2]/20 transition-colors absolute right-0">
                            <div className="text-right">
                                <div className="text-gray-400 text-xs uppercase tracking-wider font-semibold">{t('joinCommunity')}</div>
                                <div className="text-[#5865F2] font-bold">{t('discordServer')}</div>
                            </div>
                            <div className="w-10 h-10 rounded-lg bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center">
                                <Crown size={20} />
                            </div>
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
