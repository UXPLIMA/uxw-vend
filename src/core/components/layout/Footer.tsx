"use client";

import { Link, usePathname, useRouter } from "@/core/lib/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Globe, Mail, Users, Heart } from "lucide-react";
import { serverConfig } from "@/core/config/server";
import { localeNames, locales, type Locale } from "@/core/lib/i18n/config";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { useAllModules } from "@/core/providers/module-provider";
import { ModuleFooterLinks, ModuleNavLinks, ModuleRoutes, ModuleFooterComponents, FooterComponentRegistry } from "@/core/generated/module-registry";
import { ModuleErrorBoundary } from "@/core/components/ModuleErrorBoundary";
import { FooterDropdown } from "@/core/components/ui/footer-dropdown";
import { Slot } from "@/core/components/Slot";
import { parseFooterLinks, type FooterLink } from "@/core/lib/footer-links";


const FOOTER_LINK_CLASS = "text-muted-foreground hover:text-foreground transition-colors";

/** Internal links go through next-intl's locale-aware Link; external ones don't. */
function FooterLinkItem({ link }: { link: FooterLink }) {
    if (link.external) {
        return (
            <a href={link.href} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK_CLASS}>
                {link.label}
            </a>
        );
    }
    return <Link href={link.href} className={FOOTER_LINK_CLASS}>{link.label}</Link>;
}

function DefaultFooter() {
    const t = useTranslations('footer');
    const commonT = useTranslations('common');
    const navT = useTranslations('nav');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const moduleStatus = useAllModules();
    const { settings } = useSiteSettings();

    // Prefer DB settings, fall back to serverConfig defaults
    const siteName = (settings.site_name as string) || serverConfig.name;
    const siteDescription = (settings.footer_about_text as string)
        || (settings.site_description as string)
        || serverConfig.description;
    const siteEmail = (settings.site_email as string) || serverConfig.email;
    // site_discord_url is the canonical key; hero_discord_url is read as a
    // back-compat fallback for installs migrated from older versions where
    // the Discord URL lived under the (misnamed) hero_* namespace.
    const communityUrl = (settings.site_discord_url as string)
        || (settings.hero_discord_url as string)
        || serverConfig.communityUrl;

    // Build path→module map from registry - zero hardcoded module names
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
        if (isEnabledIn(moduleStatus, nl.module)) installedModulePaths.add(nl.href);
    }
    for (const fl of ModuleFooterLinks) {
        if (isEnabledIn(moduleStatus, fl.module)) installedModulePaths.add(fl.href);
    }
    for (const r of ModuleRoutes) {
        if (!r.isAdmin && isEnabledIn(moduleStatus, r.module)) {
            installedModulePaths.add('/' + r.path.split('/')[0]);
        }
    }

    // Module footer links grouped by the section they declare. Core renders
    // two named columns; a link naming any other section joins Quick Links
    // rather than vanishing, which is what filtering on `section === "quick"`
    // silently did to it.
    const enabledFooterLinks = ModuleFooterLinks.filter((fl) => isEnabledIn(moduleStatus, fl.module));
    const toLink = (fl: { label: string; href: string }): FooterLink => ({ ...fl, external: false });
    const legalLinks: FooterLink[] = [
        ...parseFooterLinks(settings.footer_legal_links),
        ...enabledFooterLinks.filter((fl) => fl.section === "legal").map(toLink),
    ];
    const quickLinks: FooterLink[] = [
        ...parseFooterLinks(settings.footer_quick_links),
        ...enabledFooterLinks.filter((fl) => fl.section !== "legal").map(toLink),
    ];

    // The legal column only exists when something fills it, so the remaining
    // columns keep an even split instead of leaving a hole in the grid.
    const columnClass = legalLinks.length > 0 ? "md:grid-cols-4" : "md:grid-cols-3";

    const handleLocaleChange = (newLocale: string) => {
        router.replace(pathname, { locale: newLocale });
    };

    return (
        <>
        <footer className="bg-card text-card-foreground border-t border-border mt-12">
            <Slot name="footer.top" />
            <div className="container mx-auto px-4 py-12">
                <div className={`grid ${columnClass} gap-8`}>
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-foreground font-bold text-lg">{siteName}</span>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                            {siteDescription}
                        </p>
                        <ul className="flex gap-3 list-none p-0" aria-label={navT('social')}>
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
                                <li><a href={communityUrl} target="_blank" rel="noopener noreferrer" aria-label={navT('community')} className="w-8 h-8 rounded-full bg-white/10 hover:bg-primary flex items-center justify-center transition-colors">
                                    <Users className="w-4 h-4" aria-hidden="true" />
                                </a></li>
                            )}
                        </ul>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-semibold text-foreground mb-4">{t('quickLinks')}</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">{commonT('home')}</Link></li>
                            {quickLinks.map(fl => (
                                <li key={fl.href}><FooterLinkItem link={fl} /></li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal - admin-authored links plus anything modules contribute.
                        Core names no legal page of its own. */}
                    {legalLinks.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-foreground mb-4">{t('legal')}</h4>
                            <ul className="space-y-2 text-sm">
                                {legalLinks.map(fl => (
                                    <li key={fl.href}><FooterLinkItem link={fl} /></li>
                                ))}
                            </ul>
                        </div>
                    )}

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
                                .filter((fc) => isEnabledIn(moduleStatus, fc.module) && FooterComponentRegistry[fc.id])
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

                        {siteEmail && (
                            <div className="mt-6">
                                <p className="text-muted-foreground text-sm flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    {siteEmail}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-white/10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-muted-foreground text-sm">
                            {(settings.footer_copyright as string)
                                || `© ${new Date().getFullYear()} ${siteName}. ${t('allRightsReserved')}`}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{t('builtWith')}</span>
                            <Heart className="w-4 h-4 text-red-400 fill-red-400" />
                            <span>{t('by')}</span>
                            <span className="text-blue-400 font-medium">{siteName}</span>
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
import { isEnabledIn } from "@/core/lib/module-enabled";

export function Footer() {
    return <ThemeComponentSlot name="Footer" fallback={DefaultFooter} />;
}
