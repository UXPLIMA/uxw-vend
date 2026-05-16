"use client";

import { Link, usePathname } from "@/core/lib/i18n/navigation";
import { Home, ShoppingCart, HelpCircle, MessageSquare, User, LogOut, Shield, Sun, Moon, Star, Download, Gift, Crown, FileText, ChevronDown, Trophy, Vote, Dices, History, Users } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { useDarkMode } from "@/core/hooks/useDarkMode";
import Image from "next/image";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { useAllModules } from "@/core/providers/module-provider";
import { ModuleNavLinks, ModuleRoutes, ModuleNavbarComponents, NavbarComponentRegistry } from "@/core/generated/module-registry";
import { ModuleErrorBoundary } from "@/core/components/ModuleErrorBoundary";
import { Slot } from "@/core/components/Slot";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Home, ShoppingCart, HelpCircle, MessageSquare, Star, Download, Gift, Crown, FileText,
    Trophy, Vote, Dices, History, Users, Shield,
};

function DefaultNavbar() {
    const pathname = usePathname();
    const t = useTranslations('nav');
    const commonT = useTranslations('common');
    const { data: session, status } = useSession();
    const [menuOpen, setMenuOpen] = useState(false);
    const [navDropdown, setNavDropdown] = useState<string | null>(null);
    const { settings } = useSiteSettings();
    const moduleStatus = useAllModules();
    const [mounted, setMounted] = useState(false);
    const { isDark, toggle: toggleDarkMode } = useDarkMode();

     
    useEffect(() => { setMounted(true); }, []);

    // Build nav links: admin-configured links take priority, fallback to module-registered links
    // pathToModule maps top-level path prefixes to module IDs using both navLinks and routes
    const pathToModule: Record<string, string> = {};
    for (const nl of ModuleNavLinks) { pathToModule[nl.href] = nl.module; }
    for (const r of ModuleRoutes) {
        if (!r.isAdmin) {
            const prefix = '/' + r.path.split('/')[0];
            if (!pathToModule[prefix]) pathToModule[prefix] = r.module;
        }
    }

    // Installed module path prefixes (only from currently installed/enabled modules)
    const installedModulePaths = new Set<string>();
    for (const nl of ModuleNavLinks) {
        if (moduleStatus[nl.module] === true) installedModulePaths.add(nl.href);
    }
    for (const r of ModuleRoutes) {
        if (!r.isAdmin && moduleStatus[r.module] === true) {
            installedModulePaths.add('/' + r.path.split('/')[0]);
        }
    }

    // Core paths that are always valid (not served by modules)
    const corePaths = new Set(['/', '/profile', '/admin', '/auth', '/terms', '/privacy', '/rules', '/refund']);

    // When admin has explicitly configured navbar_links, we use a permissive filter:
    // only hide links that are *known* to belong to a disabled/uninstalled module.
    // When using auto-generated registry links, be strict and hide unknown paths.
    const adminConfigured = Array.isArray(settings.navbar_links);

    const isLinkEnabled = (href: string) => {
        // Dropdown parent placeholders ("#") — always allowed; children are filtered separately
        if (!href || href === "#") return true;
        // External URLs always allowed
        if (href.startsWith('http')) return true;
        // Core paths always allowed
        if (corePaths.has(href)) return true;
        // Check if this href maps to a known module
        const moduleId = pathToModule[href];
        if (moduleId) return moduleStatus[moduleId] === true;
        // For DB-saved links: if the path is served by an installed module, allow it
        if (installedModulePaths.has(href)) return true;
        // If admin explicitly configured these links, trust unknown paths
        // (they may point to static pages, external redirects, or custom routes)
        if (adminConfigured) return true;
        // Auto-generated registry links: unknown internal path not served by any installed module — hide it
        return false;
    };

    // Default links: Home + enabled module navLinks from registry
    const registryLinks = [
        { label: t('home'), href: "/", icon: "Home" },
        ...ModuleNavLinks
            .filter(nl => moduleStatus[nl.module] === true)
            .map(nl => ({ label: nl.label, href: nl.href, icon: nl.icon || "Package" })),
    ];

    const rawNavLinks = (Array.isArray(settings.navbar_links) ? settings.navbar_links : registryLinks) as { label: string; href: string; icon?: string; children?: { label: string; href: string }[] }[];

    // Filter out disabled module links (including from dropdown children)
    const navLinks = rawNavLinks
        .filter((link) => isLinkEnabled(link.href))
        .map((link) => {
            if (link.children) {
                const filtered = link.children.filter((child) => isLinkEnabled(child.href));
                if (filtered.length === 0) return null;
                return { ...link, children: filtered };
            }
            return link;
        })
        .filter(Boolean) as typeof rawNavLinks;

    const menuRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setNavDropdown(null);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Navbar components from modules (bell, cart, etc.)
    const enabledNavbarComponents = ModuleNavbarComponents
        .filter(nc => moduleStatus[nc.module] === true)
        .filter(nc => NavbarComponentRegistry[nc.id]);

    const isActive = (path: string) => path === "/" ? pathname === "/" : pathname.startsWith(path);
    const isStaffUser = (session?.user?.rolePriority ?? 0) >= 50;

    return (
        <>
        <Slot name="layout.top" />
        <header className="bg-card border-b border-[var(--color-border)] sticky top-0 z-50">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-12 gap-2">
                    {/* Mobile-only brand link (nav links live in MobileBottomNav) */}
                    <Link href="/" className="sm:hidden flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-semibold text-foreground hover:bg-muted transition-colors">
                        <Home className="w-4 h-4" />
                        <span className="truncate">{t('home')}</span>
                    </Link>
                    <nav className="hidden sm:flex items-center gap-1 min-w-0 flex-1 flex-wrap" aria-label="Primary">
                        <Slot name="navbar.start" />
                        {navLinks.map((link) => {
                            const IconComp = link.icon ? iconMap[link.icon] : null;

                            // Dropdown menu
                            if (link.children && link.children.length > 0) {
                                return (
                                    <div key={link.label} className="relative"
                                        onMouseEnter={() => setNavDropdown(link.label)}
                                        onMouseLeave={() => setNavDropdown(null)}
                                    >
                                        <button
                                            type="button"
                                            aria-haspopup="menu"
                                            aria-expanded={navDropdown === link.label}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${navDropdown === link.label ? "text-primary bg-muted" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                                        >
                                            {IconComp && <IconComp className="w-4 h-4" />}
                                            {link.label}
                                            <ChevronDown className={`w-3 h-3 transition-transform ${navDropdown === link.label ? "rotate-180" : ""}`} />
                                        </button>
                                        {navDropdown === link.label && (
                                            <div className="absolute top-full left-0 pt-1 z-50">
                                                <div className="w-52 bg-card border border-[var(--color-border)] rounded-lg shadow-lg py-1 animate-fade-in">
                                                    {link.children.map((child: { label: string; href: string; icon?: string }) => {
                                                        const ChildIcon = child.icon ? iconMap[child.icon] : null;
                                                        return (
                                                            <Link key={child.href} href={child.href}
                                                                onClick={() => setNavDropdown(null)}
                                                                className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                                                {ChildIcon && <ChildIcon className="w-4 h-4 text-muted-foreground" />}
                                                                {child.label}
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            // Normal link
                            return (
                                <Link key={link.href} href={link.href}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive(link.href) ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                                    {IconComp && <IconComp className="w-4 h-4" />}
                                    {link.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="flex items-center gap-2">
                        {mounted && (
                            <button onClick={toggleDarkMode} aria-label={isDark ? t('switchToLight') : t('switchToDark')}
                                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </button>
                        )}

                        {session?.user ? (
                            <>
                                {/* Module navbar components (bell, cart, etc.) — from registry */}
                                {enabledNavbarComponents.map(nc => {
                                    const NavComp = NavbarComponentRegistry[nc.id];
                                    return (
                                        <ModuleErrorBoundary key={nc.id} fallbackLabel={`Failed to load ${nc.id}`}>
                                            <NavComp />
                                        </ModuleErrorBoundary>
                                    );
                                })}

                                <Slot name="navbar.end" />

                                <div className="relative" ref={menuRef}>
                                    <button
                                        type="button"
                                        onClick={() => setMenuOpen(!menuOpen)}
                                        aria-label={`${t('profile')} menu`}
                                        aria-haspopup="menu"
                                        aria-expanded={menuOpen}
                                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors">
                                        {session.user.image ? (
                                            <Image src={session.user.image} alt="" width={28} height={28} className="w-7 h-7 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                                                {(session.user.name || "U")[0].toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-sm font-medium text-foreground hidden sm:block">{session.user.name}</span>
                                    </button>

                                    {menuOpen && (
                                        <div className="absolute right-0 top-full mt-1 w-48 bg-card rounded-lg shadow-lg border border-border py-1 z-50 animate-fade-in">
                                            <div className="px-3 py-2 border-b border-border">
                                                <p className="text-sm font-medium text-foreground truncate">{session.user.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                                            </div>
                                            <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setMenuOpen(false)}>
                                                <User className="w-4 h-4" /> {t('profile')}
                                            </Link>
                                            {isStaffUser && (
                                                <Link href="/admin" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setMenuOpen(false)}>
                                                    <Shield className="w-4 h-4" /> {t('adminPanel')}
                                                </Link>
                                            )}
                                            <div className="border-t border-border">
                                                <button onClick={() => signOut({ callbackUrl: "/" })} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                                                    <LogOut className="w-4 h-4" /> {commonT('logout')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link href="/auth/login"><Button variant="ghost" size="sm" className="text-muted-foreground">{commonT('login')}</Button></Link>
                                <Link href="/auth/register"><Button size="sm">{commonT('register')}</Button></Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
        </>
    );
}

import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

export function Navbar() {
    return <ThemeComponentSlot name="Navbar" fallback={DefaultNavbar} />;
}
