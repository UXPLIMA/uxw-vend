"use client";

import { Link, usePathname, useRouter } from "@/core/lib/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Globe, Mail, Heart } from "lucide-react";
import { serverConfig } from "@/core/config/server";
import { localeNames, locales, type Locale } from "@/core/lib/i18n/config";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { useAllModules } from "@/core/providers/module-provider";
import { ModuleFooterLinks, ModuleNavLinks, ModuleRoutes, ModuleFooterComponents, FooterComponentRegistry } from "@/core/generated/module-registry";
import { ModuleErrorBoundary } from "@/core/components/ModuleErrorBoundary";
import { FooterDropdown } from "@/core/components/ui/footer-dropdown";
import { Slot } from "@/core/components/Slot";


function DefaultFooter() {
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
    // site_discord_url is the canonical key; hero_discord_url is read as a
    // back-compat fallback for installs migrated from older versions where
    // the Discord URL lived under the (misnamed) hero_* namespace.
    const communityUrl = (settings.site_discord_url as string)
        || (settings.hero_discord_url as string)
        || serverConfig.communityUrl;

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
        <>
        <footer className="bg-card text-card-foreground border-t border-border mt-12">
            <Slot name="footer.top" />
            <div className="container mx-auto px-4 py-12">
                <div className="grid md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-foreground font-bold text-lg">{siteName}</span>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                            {siteDescription}
                        </p>
                        <ul className="flex gap-3 list-none p-0" aria-label="Social media">
                            {serverConfig.social.facebook && (
                                <li><a href={serverConfig.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-8 h-8 rounded-full bg-white/10 hover:bg-blue-600 flex items-center justify-center transition-colors text-xs font-bold">
                                    <span aria-hidden="true">f</span>
                                </a></li>
                            )}
                            {serverConfig.social.instagram && (
                                <li><a href={serverConfig.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-8 h-8 rounded-full bg-white/10 hover:bg-pink-600 flex items-center justify-center transition-colors text-xs font-bold">
                                    <span aria-hidden="true">ig</span>
                                </a></li>
                            )}
                            {serverConfig.social.twitter && (
                                <li><a href={serverConfig.social.twitter} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="w-8 h-8 rounded-full bg-white/10 hover:bg-sky-500 flex items-center justify-center transition-colors text-xs font-bold">
                                    <span aria-hidden="true">X</span>
                                </a></li>
                            )}
                            {serverConfig.social.youtube && (
                                <li><a href={serverConfig.social.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-600 flex items-center justify-center transition-colors text-xs font-bold">
                                    <span aria-hidden="true">yt</span>
                                </a></li>
                            )}
                            {communityUrl && (
                                <li><a href={communityUrl} target="_blank" rel="noopener noreferrer" aria-label="Community" className="w-8 h-8 rounded-full bg-white/10 hover:bg-primary flex items-center justify-center transition-colors">
                                    <Mail className="w-4 h-4" aria-hidden="true" />
                                </a></li>
                            )}
                        </ul>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-semibold text-foreground mb-4">{t('quickLinks')}</h4>
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
                        <h4 className="font-semibold text-foreground mb-4">{t('legal')}</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link href="/legal/terms" className="text-muted-foreground hover:text-foreground transition-colors">{t('termsOfService')}</Link></li>
                            <li><Link href="/legal/privacy" className="text-muted-foreground hover:text-foreground transition-colors">{t('privacyPolicy')}</Link></li>
                            <li><Link href="/legal/refund" className="text-muted-foreground hover:text-foreground transition-colors">{t('refundPolicy')}</Link></li>
                            <li><Link href="/legal/rules" className="text-muted-foreground hover:text-foreground transition-colors">{t('serverRules')}</Link></li>
                        </ul>
                    </div>

                    {/* Settings */}
                    <div>
                        <h4 className="font-semibold text-foreground mb-4">{commonT('settings')}</h4>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-muted-foreground" />
                                <FooterDropdown
                                    options={locales}
                                    value={locale}
                                    onChange={handleLocaleChange}
                                    formatLabel={(l) => localeNames[l as Locale]}
                                />
                            </div>
                            {ModuleFooterComponents
                                .filter((fc) => moduleStatus[fc.module] === true && FooterComponentRegistry[fc.id])
                                .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
                                .map((fc) => {
                                    const Comp = FooterComponentRegistry[fc.id];
                                    return (
                                        <ModuleErrorBoundary key={fc.id}>
                                            <Comp />
                                        </ModuleErrorBoundary>
                                    );
                                })}
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
        <Slot name="layout.bottom" />
        </>
    );
}

import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

export function Footer() {
    return <ThemeComponentSlot name="Footer" fallback={DefaultFooter} />;
}
