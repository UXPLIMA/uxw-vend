"use client";

import { Link } from "@/core/lib/i18n/navigation";
import { serverConfig } from "@/core/config/server";
import { useTranslations } from "next-intl";
import { useAllModules } from "@/core/providers/module-provider";
import { ModuleFooterLinks, ModuleRoutes } from "@/core/generated/module-registry";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { Slot } from "@/core/components/Slot";

export default function PixelCraftFooter() {
    const t = useTranslations('footer');
    const moduleStatus = useAllModules();
    const { settings } = useSiteSettings();

    // Build link-enabled check from the module registry (same logic core uses).
    const pathToModule: Record<string, string> = {};
    for (const fl of ModuleFooterLinks) { pathToModule[fl.href] = fl.module; }
    for (const r of ModuleRoutes) {
        if (!r.isAdmin) {
            const prefix = '/' + r.path.split('/')[0];
            if (!pathToModule[prefix]) pathToModule[prefix] = r.module;
        }
    }
    const corePaths = new Set(['/', '/profile', '/admin', '/auth', '/terms', '/privacy', '/rules', '/refund']);
    const isLinkEnabled = (href: string) => {
        if (!href || href === '#') return true;
        if (href.startsWith('http')) return true;
        if (corePaths.has(href)) return true;
        const mod = pathToModule[href];
        if (mod) return moduleStatus[mod] === true;
        return true;
    };

    // Gather footer links by section from the registry.
    const linksBySection: Record<string, { label: string; href: string }[]> = {};
    for (const fl of ModuleFooterLinks) {
        if (moduleStatus[fl.module] !== true) continue;
        const section = fl.section || 'quick';
        if (!linksBySection[section]) linksBySection[section] = [];
        linksBySection[section].push({ label: fl.label, href: fl.href });
    }

    const quickLinks = [
        { label: t('home'), href: "/" },
        ...(linksBySection['quick'] || []),
    ].filter(l => isLinkEnabled(l.href));

    const communityLinks = (linksBySection['community'] || []).filter(l => isLinkEnabled(l.href));

    const discordUrl = (settings.footer_discord_url as string) || serverConfig.communityUrl;
    const serverIp = (settings.footer_server_ip as string) || serverConfig.ip;

    return (
        <>
            <footer
                style={{
                    background: "var(--color-card)",
                    borderTop: "3px solid var(--color-border)",
                }}
            >
                {/* Main footer */}
                <div className="container mx-auto px-4 py-10">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        {/* Brand */}
                        <div>
                            <h3
                                className="mb-4"
                                style={{
                                    fontFamily: "var(--font-heading)",
                                    fontSize: "12px",
                                    color: "var(--color-primary)",
                                }}
                            >
                                {serverConfig.name}
                            </h3>
                            <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
                                {serverConfig.description}
                            </p>
                        </div>

                        {/* Quick Links */}
                        <div>
                            <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--color-foreground)" }}>
                                {t('quickLinks')}
                            </h4>
                            <div className="space-y-2">
                                {quickLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className="block text-sm transition-colors"
                                        style={{ color: "var(--color-muted-foreground)" }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-muted-foreground)")}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Community */}
                        <div>
                            <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--color-foreground)" }}>
                                Community
                            </h4>
                            <div className="space-y-2">
                                {communityLinks.length === 0 ? (
                                    <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                                        {/* No community modules installed yet */}
                                        —
                                    </p>
                                ) : (
                                    communityLinks.map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            className="block text-sm transition-colors"
                                            style={{ color: "var(--color-muted-foreground)" }}
                                            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
                                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-muted-foreground)")}
                                        >
                                            {link.label}
                                        </Link>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Server Info */}
                        <div>
                            <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--color-foreground)" }}>
                                Server
                            </h4>
                            <div className="space-y-3">
                                <div
                                    className="p-3"
                                    style={{
                                        background: "var(--color-muted)",
                                        border: "1px solid var(--color-border)",
                                        borderRadius: "var(--radius)",
                                    }}
                                >
                                    <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--color-muted-foreground)" }}>Server IP</p>
                                    <p
                                        className="font-bold"
                                        style={{
                                            color: "var(--color-primary)",
                                            fontFamily: "var(--font-heading)",
                                            fontSize: "9px",
                                        }}
                                    >
                                        {serverIp.toUpperCase()}
                                    </p>
                                </div>
                                <a
                                    href={discordUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-3 text-center text-sm font-bold uppercase transition-colors"
                                    style={{
                                        background: "#5865F2",
                                        color: "#fff",
                                        borderBottom: "3px solid #4752c4",
                                        borderRadius: "var(--radius)",
                                    }}
                                >
                                    Discord
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom bar */}
                <div style={{ background: "var(--color-background)", borderTop: "1px solid var(--color-border)" }}>
                    <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                        <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                            {t('allRightsReserved')} © {new Date().getFullYear()} {serverConfig.name}
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                            Powered by <span style={{ color: "var(--color-primary)" }}>uxwVend</span>
                        </p>
                    </div>
                </div>
            </footer>

            {/* Slot below the footer — modules can inject cookie banners, toasts, etc. */}
            <Slot name="layout.bottom" />
        </>
    );
}
