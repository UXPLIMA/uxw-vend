"use client";

import { Link } from "@/core/lib/i18n/navigation";
import { serverConfig } from "@/core/config/server";
import { useTranslations } from "next-intl";
import { useModules } from "@/core/hooks/useModule";

export default function PixelCraftFooter() {
    const t = useTranslations('footer');
    const { modules: moduleStatus } = useModules();

    const pathToModule: Record<string, string> = {
        "/store": "store", "/forum": "forum", "/support": "support", "/blog": "blog",
        "/wheel": "wheel", "/vote": "vote", "/leaderboard": "leaderboard",
        "/suggestions": "suggestions", "/changelog": "changelog", "/staff": "staff",
        "/downloads": "downloads", "/punishments": "punishments",
    };
    const isLinkEnabled = (href: string) => {
        const mod = pathToModule[href];
        return !mod || moduleStatus[mod] !== false;
    };

    return (
        <footer style={{ background: "#1e1e1e", borderTop: "3px solid #3a3a3a" }}>
            {/* Main footer */}
            <div className="container mx-auto px-4 py-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div>
                        <h3 className="mb-4" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px", color: "#3ea72d" }}>
                            {serverConfig.name}
                        </h3>
                        <p className="text-sm leading-relaxed" style={{ color: "#8c8c8c" }}>
                            {serverConfig.description}
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "#e8e8e8" }}>
                            {t('quickLinks')}
                        </h4>
                        <div className="space-y-2">
                            {[
                                { label: "Home", href: "/" },
                                { label: "Store", href: "/store" },
                                { label: "Forum", href: "/forum" },
                                { label: "Support", href: "/support" },
                            ].filter(link => isLinkEnabled(link.href)).map((link) => (
                                <Link key={link.href} href={link.href} className="block text-sm transition-colors" style={{ color: "#8c8c8c" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = "#3ea72d")}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = "#8c8c8c")}>
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Community */}
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "#e8e8e8" }}>
                            Community
                        </h4>
                        <div className="space-y-2">
                            {[
                                { label: "Leaderboard", href: "/leaderboard" },
                                { label: "Suggestions", href: "/suggestions" },
                                { label: "Changelog", href: "/changelog" },
                                { label: "Staff", href: "/staff" },
                            ].filter(link => isLinkEnabled(link.href)).map((link) => (
                                <Link key={link.href} href={link.href} className="block text-sm transition-colors" style={{ color: "#8c8c8c" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = "#3ea72d")}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = "#8c8c8c")}>
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Server Info */}
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "#e8e8e8" }}>
                            Server
                        </h4>
                        <div className="space-y-3">
                            <div className="p-3 rounded-sm" style={{ background: "#2a2a2a", border: "1px solid #3a3a3a" }}>
                                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#8c8c8c" }}>Server IP</p>
                                <p className="font-bold" style={{ color: "#3ea72d", fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}>
                                    {serverConfig.ip.toUpperCase()}
                                </p>
                            </div>
                            <a href={serverConfig.discordUrl} target="_blank" rel="noopener noreferrer"
                                className="block p-3 rounded-sm text-center text-sm font-bold uppercase transition-colors"
                                style={{ background: "#5865F2", color: "#fff", borderBottom: "3px solid #4752c4" }}>
                                Discord
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom bar */}
            <div style={{ background: "#161616", borderTop: "1px solid #2a2a2a" }}>
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <p className="text-xs" style={{ color: "#666" }}>
                        {t('allRightsReserved')} © {new Date().getFullYear()} {serverConfig.name}
                    </p>
                    <p className="text-xs" style={{ color: "#666" }}>
                        Powered by <span style={{ color: "#3ea72d" }}>uxwVend</span>
                    </p>
                </div>
            </div>
        </footer>
    );
}
