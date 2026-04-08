"use client";

import { Link, usePathname } from "@/core/lib/i18n/navigation";
import { Home, ShoppingCart, HelpCircle, MessageSquare, User, LogOut, Shield, Star, Download, Gift, Crown, FileText, ChevronDown, Trophy, Vote, Dices, History, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { useAllModules } from "@/core/providers/module-provider";
import { ModuleNavLinks, ModuleRoutes, ModuleNavbarComponents, NavbarComponentRegistry } from "@/core/generated/module-registry";
import { ModuleErrorBoundary } from "@/core/components/ModuleErrorBoundary";
import { Slot } from "@/core/components/Slot";

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    Home, ShoppingCart, HelpCircle, MessageSquare, Star, Download, Gift, Crown, FileText,
    Trophy, Vote, Dices, History, Users, Shield,
};

export default function PixelCraftNavbar() {
    const pathname = usePathname();
    const t = useTranslations('nav');
    const commonT = useTranslations('common');
    const { data: session, status } = useSession();
    const [menuOpen, setMenuOpen] = useState(false);
    const [navDropdown, setNavDropdown] = useState<string | null>(null);
    const { settings } = useSiteSettings();
    const moduleStatus = useAllModules();
    const menuRef = useRef<HTMLDivElement>(null);

    // Build nav links registry-driven (parity with core Navbar)
    const pathToModule: Record<string, string> = {};
    for (const nl of ModuleNavLinks) { pathToModule[nl.href] = nl.module; }
    for (const r of ModuleRoutes) {
        if (!r.isAdmin) {
            const prefix = '/' + r.path.split('/')[0];
            if (!pathToModule[prefix]) pathToModule[prefix] = r.module;
        }
    }

    const installedModulePaths = new Set<string>();
    for (const nl of ModuleNavLinks) {
        if (moduleStatus[nl.module] === true) installedModulePaths.add(nl.href);
    }
    for (const r of ModuleRoutes) {
        if (!r.isAdmin && moduleStatus[r.module] === true) {
            installedModulePaths.add('/' + r.path.split('/')[0]);
        }
    }

    const corePaths = new Set(['/', '/profile', '/admin', '/auth', '/terms', '/privacy', '/rules', '/refund']);

    const isLinkEnabled = (href: string) => {
        if (!href || href === "#") return true;
        if (href.startsWith('http')) return true;
        if (corePaths.has(href)) return true;
        const moduleId = pathToModule[href];
        if (moduleId) return moduleStatus[moduleId] === true;
        if (installedModulePaths.has(href)) return true;
        return false;
    };

    const registryLinks = [
        { label: t('home'), href: "/", icon: "Home" },
        ...ModuleNavLinks
            .filter(nl => moduleStatus[nl.module] === true)
            .map(nl => ({ label: nl.label, href: nl.href, icon: nl.icon || "Package" })),
    ];

    const rawNavLinks = (Array.isArray(settings.navbar_links) ? settings.navbar_links : registryLinks) as { label: string; href: string; icon?: string; children?: { label: string; href: string; icon?: string }[] }[];

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

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Module navbar icons from registry (cart, bell, etc.)
    const enabledNavbarComponents = ModuleNavbarComponents
        .filter(nc => moduleStatus[nc.module] === true)
        .filter(nc => NavbarComponentRegistry[nc.id]);

    const isActive = (path: string) => path === "/" ? pathname === "/" : pathname.startsWith(path);
    const isStaffUser = (session?.user?.rolePriority ?? 0) >= 50;

    return (
        <>
            {/* Slot above the header — modules can inject banners, announcements, etc. */}
            <Slot name="layout.top" />

            <header
                className="sticky top-0 z-50"
                style={{
                    background: "var(--color-card)",
                    borderBottom: "3px solid var(--color-primary)",
                }}
            >
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between h-14">
                        {/* Logo */}
                        <Link
                            href="/"
                            style={{
                                fontFamily: "var(--font-heading)",
                                color: "var(--color-primary)",
                                fontSize: "14px",
                                textTransform: "uppercase",
                                letterSpacing: "2px",
                            }}
                        >
                            uxwVend
                        </Link>

                        {/* Nav Links */}
                        <nav className="hidden md:flex items-center gap-1">
                            {navLinks.map((link) => {
                                const IconComp = link.icon ? iconMap[link.icon] : null;

                                if (link.children && link.children.length > 0) {
                                    return (
                                        <div key={link.label} className="relative"
                                            onMouseEnter={() => setNavDropdown(link.label)}
                                            onMouseLeave={() => setNavDropdown(null)}
                                        >
                                            <button
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold uppercase tracking-wider transition-colors"
                                                style={{
                                                    color: navDropdown === link.label ? "var(--color-primary)" : "var(--color-muted-foreground)",
                                                    borderBottom: navDropdown === link.label ? "2px solid var(--color-primary)" : "2px solid transparent",
                                                }}
                                            >
                                                {IconComp && <IconComp className="w-4 h-4" />}
                                                {link.label}
                                                <ChevronDown className={`w-3 h-3 transition-transform ${navDropdown === link.label ? "rotate-180" : ""}`} />
                                            </button>
                                            {navDropdown === link.label && (
                                                <div className="absolute top-full left-0 pt-1 z-50">
                                                    <div
                                                        className="w-52 py-1"
                                                        style={{
                                                            background: "var(--color-muted)",
                                                            border: "1px solid var(--color-border)",
                                                            borderRadius: "var(--radius)",
                                                        }}
                                                    >
                                                        {link.children.map((child) => {
                                                            const ChildIcon = child.icon ? iconMap[child.icon] : null;
                                                            return (
                                                                <Link key={child.href} href={child.href}
                                                                    onClick={() => setNavDropdown(null)}
                                                                    className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                                                                    style={{ color: "var(--color-muted-foreground)" }}
                                                                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-foreground)"; e.currentTarget.style.background = "var(--color-background)"; }}
                                                                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-muted-foreground)"; e.currentTarget.style.background = "transparent"; }}
                                                                >
                                                                    {ChildIcon && <ChildIcon className="w-4 h-4" style={{ color: "var(--color-primary)" }} />}
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

                                return (
                                    <Link key={link.href} href={link.href}
                                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold uppercase tracking-wider transition-colors"
                                        style={{
                                            color: isActive(link.href) ? "var(--color-primary)" : "var(--color-muted-foreground)",
                                            borderBottom: isActive(link.href) ? "2px solid var(--color-primary)" : "2px solid transparent",
                                        }}>
                                        {IconComp && <IconComp className="w-4 h-4" />}
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Right side */}
                        <div className="flex items-center gap-2">
                            {status === "loading" ? (
                                <div className="w-8 h-8 rounded animate-pulse" style={{ background: "var(--color-muted)" }} />
                            ) : session?.user ? (
                                <>
                                    {/* Module navbar components (bell, cart, etc.) from registry */}
                                    {enabledNavbarComponents.map(nc => {
                                        const NavComp = NavbarComponentRegistry[nc.id];
                                        return (
                                            <ModuleErrorBoundary key={nc.id} fallbackLabel={`Failed to load ${nc.id}`}>
                                                <NavComp />
                                            </ModuleErrorBoundary>
                                        );
                                    })}

                                    {/* Slot for any extra navbar icons modules want to contribute */}
                                    <Slot name="navbar.icons" />

                                    <div className="relative" ref={menuRef}>
                                        <button
                                            onClick={() => setMenuOpen(!menuOpen)}
                                            className="flex items-center gap-2 px-2 py-1.5 transition-colors"
                                            style={{ borderRadius: "var(--radius)" }}
                                        >
                                            <div
                                                className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                                                style={{
                                                    background: "var(--color-primary)",
                                                    color: "#fff",
                                                    borderRadius: "var(--radius)",
                                                }}
                                            >
                                                {(session.user.name || "U")[0].toUpperCase()}
                                            </div>
                                            <span className="text-sm font-medium hidden sm:block" style={{ color: "var(--color-foreground)" }}>
                                                {session.user.name}
                                            </span>
                                        </button>

                                        {menuOpen && (
                                            <div
                                                className="absolute right-0 top-full mt-1 w-48 py-1 z-50"
                                                style={{
                                                    background: "var(--color-muted)",
                                                    border: "1px solid var(--color-border)",
                                                    borderRadius: "var(--radius)",
                                                }}
                                            >
                                                <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
                                                    <p className="text-sm font-medium truncate" style={{ color: "var(--color-foreground)" }}>{session.user.name}</p>
                                                    <p className="text-xs truncate" style={{ color: "var(--color-muted-foreground)" }}>{session.user.email}</p>
                                                </div>
                                                <Link
                                                    href="/profile"
                                                    className="flex items-center gap-2 px-3 py-2 text-sm"
                                                    style={{ color: "var(--color-muted-foreground)" }}
                                                    onClick={() => setMenuOpen(false)}
                                                >
                                                    <User className="w-4 h-4" /> {t('profile')}
                                                </Link>
                                                {isStaffUser && (
                                                    <Link
                                                        href="/admin"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 px-3 py-2 text-sm"
                                                        style={{ color: "var(--color-muted-foreground)" }}
                                                        onClick={() => setMenuOpen(false)}
                                                    >
                                                        <Shield className="w-4 h-4" /> {t('adminPanel')}
                                                    </Link>
                                                )}
                                                <button
                                                    onClick={() => signOut({ callbackUrl: "/" })}
                                                    className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left"
                                                    style={{ color: "var(--color-destructive)" }}
                                                >
                                                    <LogOut className="w-4 h-4" /> {commonT('logout')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Link href="/auth/login">
                                        <button
                                            className="px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors"
                                            style={{ color: "var(--color-muted-foreground)" }}
                                        >
                                            {commonT('login')}
                                        </button>
                                    </Link>
                                    <Link href="/auth/register">
                                        <button
                                            className="px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors"
                                            style={{
                                                background: "var(--color-primary)",
                                                color: "#fff",
                                                border: "none",
                                                borderBottom: "3px solid rgba(0,0,0,0.3)",
                                                borderRadius: "var(--radius)",
                                            }}
                                        >
                                            {commonT('register')}
                                        </button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>
        </>
    );
}
