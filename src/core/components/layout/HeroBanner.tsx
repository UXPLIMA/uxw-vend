"use client";

import { Crown, Users } from "lucide-react";
import { serverConfig } from "@/core/config/server";
import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";

export function HeroBanner() {
    const t = useTranslations('hero');
    const { settings } = useSiteSettings();

    const bgImage = (settings.hero_background_image as string) || "/background1.jpg";
    const logoImage = (settings.hero_logo_image as string) || "/logo.png";
    const serverIp = (settings.hero_server_ip as string) || serverConfig.ip;
    const discordUrl = (settings.hero_discord_url as string) || serverConfig.discordUrl;
    const height = parseInt((settings.hero_height as string) || "280");

    return (
        <div className="relative overflow-hidden bg-[#0F172A] border-b-[6px] border-blue-600" style={{ height }}>
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <img
                    src={bgImage}
                    alt="Background"
                    className="w-full h-full object-cover opacity-60"
                />
            </div>

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/80 to-transparent z-0"></div>

            <div className="relative container mx-auto px-4 h-full z-10">
                <div className="flex items-center justify-between h-full pt-6">
                    {/* Left: Players Online */}
                    <div className="group hidden md:flex items-center gap-4 bg-white/5 backdrop-blur-sm border border-white/10 px-6 py-4 rounded-xl hover:bg-white/10 transition-all duration-300 transform hover:-translate-y-1">
                        <div className="w-12 h-12 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-colors duration-300">
                            <Users size={24} />
                        </div>
                        <div className="space-y-0.5">
                            <div className="text-gray-400 text-xs uppercase tracking-wider font-semibold">{serverIp.toUpperCase()}</div>
                            <div className="text-green-400 font-bold text-lg flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                                {t('playersOnline', { count: serverConfig.onlineCount })}
                            </div>
                        </div>
                    </div>

                    {/* Center: Logo */}
                    <div className="relative z-10 transform hover:scale-105 transition-transform duration-500">
                        <div className="flex flex-col items-center">
                            <img
                                src={logoImage}
                                alt={serverConfig.name}
                                className="h-40 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] filter brightness-110"
                            />
                        </div>
                    </div>

                    {/* Right: Discord */}
                    <Link
                        href={discordUrl}
                        target="_blank"
                        className="group hidden md:flex items-center gap-4 bg-white/5 backdrop-blur-sm border border-white/10 px-6 py-4 rounded-xl hover:bg-[#5865F2] hover:border-[#5865F2] transition-all duration-300 transform hover:-translate-y-1"
                    >
                        <div className="space-y-0.5 text-right">
                            <div className="text-gray-400 group-hover:text-white/80 text-xs uppercase tracking-wider font-semibold transition-colors">
                                {t('joinCommunity')}
                            </div>
                            <div className="text-[#5865F2] group-hover:text-white font-bold text-lg transition-colors">
                                {t('discordServer')}
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-lg bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center group-hover:bg-white group-hover:text-[#5865F2] transition-all duration-300">
                            <Crown size={24} />
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
