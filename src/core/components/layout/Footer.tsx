"use client";

import { useState } from "react";
import { Link, usePathname, useRouter } from "@/core/lib/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Globe, Mail, ChevronDown, Heart } from "lucide-react";
import { serverConfig } from "@/core/config/server";
import { localeNames, locales, type Locale } from "@/core/lib/i18n/config";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { useAllModules } from "@/core/providers/module-provider";
import { ModuleFooterLinks, ModuleNavLinks, ModuleRoutes } from "@/core/generated/module-registry";

// Custom Dropdown Component for Footer
function CustomDropdown({
    options,
    value,
    onChange,
    formatLabel
}: {
    options: readonly string[] | string[];
    value: string;
    onChange: (value: string) => void;
    formatLabel?: (value: string) => string;
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm min-w-[100px]"
            >
                <span className="flex-1 text-left">{formatLabel ? formatLabel(value) : value}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-1 w-full bg-card border border-white/10 rounded shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                        {options.map((option) => (
                            <button
                                key={option}
                                onClick={() => { onChange(option); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors ${value === option ? 'bg-blue-600 text-white' : 'text-muted-foreground'}`}
                            >
                                {formatLabel ? formatLabel(option) : option}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export function Footer() {
    const t = useTranslations('footer');
    const commonT = useTranslations('common');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const moduleStatus = useAllModules();
    const { settings } = useSiteSettings();

    // Prefer DB settings, fall back to serverConfig defaults
    const siteName = (settings.site_name as string) || serverConfig.name;
    const siteDescription = (settings.site_description as string) || serverConfig.description;
    const siteEmail = (settings.site_email as string) || serverConfig.email;
    const discordUrl = (settings.hero_discord_url as string) || serverConfig.discordUrl;

    // Build path→module map from registry — zero hardcoded module names
    const pathToModule: Record<string, string> = {};
    for (const fl of ModuleFooterLinks) { pathToModule[fl.href] = fl.module; }
    for (const nl of ModuleNavLinks) { pathToModule[nl.href] = nl.module; }
    for (const r of ModuleRoutes) {
        if (!r.isAdmin) {
            const prefix = '/' + r.path.split('/')[0];
            if (!pathToModule[prefix]) pathToModule[prefix] = r.module;
        }
    }

    // Installed module path prefixes
    const installedModulePaths = new Set<string>();
    for (const nl of ModuleNavLinks) {
        if (moduleStatus[nl.module] === true) installedModulePaths.add(nl.href);
    }
    for (const fl of ModuleFooterLinks) {
        if (moduleStatus[fl.module] === true) installedModulePaths.add(fl.href);
    }
    for (const r of ModuleRoutes) {
        if (!r.isAdmin && moduleStatus[r.module] === true) {
            installedModulePaths.add('/' + r.path.split('/')[0]);
        }
    }

    const handleLocaleChange = (newLocale: string) => {
        router.replace(pathname, { locale: newLocale });
    };

    return (
        <footer className="bg-[#111827] text-white mt-12">
            <div className="container mx-auto px-4 py-12">
                <div className="grid md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-white font-bold text-lg">{siteName}</span>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                            {siteDescription}
                        </p>
                        <div className="flex gap-3">
                            {serverConfig.social.facebook && (
                                <a href={serverConfig.social.facebook} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 hover:bg-blue-600 flex items-center justify-center transition-colors text-xs font-bold">
                                    f
                                </a>
                            )}
                            {serverConfig.social.instagram && (
                                <a href={serverConfig.social.instagram} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 hover:bg-pink-600 flex items-center justify-center transition-colors text-xs font-bold">
                                    ig
                                </a>
                            )}
                            {serverConfig.social.twitter && (
                                <a href={serverConfig.social.twitter} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 hover:bg-sky-500 flex items-center justify-center transition-colors text-xs font-bold">
                                    X
                                </a>
                            )}
                            {serverConfig.social.youtube && (
                                <a href={serverConfig.social.youtube} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-600 flex items-center justify-center transition-colors text-xs font-bold">
                                    yt
                                </a>
                            )}
                            {discordUrl && (
                                <a href={discordUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 hover:bg-indigo-600 flex items-center justify-center transition-colors">
                                    <Mail className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-semibold text-white mb-4">{t('quickLinks')}</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">{commonT('home')}</Link></li>
                            {ModuleFooterLinks
                                .filter(fl => fl.section === "quick" && moduleStatus[fl.module] === true)
                                .map(fl => (
                                    <li key={fl.href}><Link href={fl.href} className="text-muted-foreground hover:text-foreground transition-colors">{fl.label}</Link></li>
                                ))}
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="font-semibold text-white mb-4">{t('legal')}</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">{t('termsOfService')}</Link></li>
                            <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">{t('privacyPolicy')}</Link></li>
                            <li><Link href="/refund" className="text-muted-foreground hover:text-foreground transition-colors">{t('refundPolicy')}</Link></li>
                            <li><Link href="/rules" className="text-muted-foreground hover:text-foreground transition-colors">{t('serverRules')}</Link></li>
                        </ul>
                    </div>

                    {/* Settings */}
                    <div>
                        <h4 className="font-semibold text-white mb-4">{commonT('settings')}</h4>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-muted-foreground" />
                                <CustomDropdown
                                    options={locales}
                                    value={locale}
                                    onChange={handleLocaleChange}
                                    formatLabel={(l) => localeNames[l as Locale]}
                                />
                            </div>
                        </div>

                        <div className="mt-6">
                            <p className="text-muted-foreground text-sm flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                {siteEmail}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-white/10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-muted-foreground text-sm">
                            © 2026 {siteName}. {t('allRightsReserved')}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{t('builtWith')}</span>
                            <Heart className="w-4 h-4 text-red-400 fill-red-400" />
                            <span>{t('by')}</span>
                            <span className="text-blue-400 font-medium">uxwVend Team</span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
