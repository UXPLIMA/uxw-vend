"use client";

import { Link, usePathname } from "@/core/lib/i18n/navigation";
import { Home, ShoppingCart, HelpCircle, MessageSquare, User, LogOut, Shield, Sun, Moon, Star, Download, Gift, Crown, FileText, Bell, ChevronDown, Trophy, Vote, Dices, History, Users } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";
import { useModules } from "@/core/hooks/useModule";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Home, ShoppingCart, HelpCircle, MessageSquare, Star, Download, Gift, Crown, FileText,
    Trophy, Vote, Dices, History, Users, Shield,
};

export function Navbar() {
    const pathname = usePathname();
    const t = useTranslations('nav');
    const commonT = useTranslations('common');
    const { data: session, status } = useSession();
    const [menuOpen, setMenuOpen] = useState(false);
    const [navDropdown, setNavDropdown] = useState<string | null>(null);
    const [cartCount, setCartCount] = useState(0);
    const [unreadNotifs, setUnreadNotifs] = useState(0);
    const { settings } = useSiteSettings();
    const { modules: moduleStatus } = useModules();
    const [mounted, setMounted] = useState(false);
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem("color-mode");
        const dark = stored === "dark";
        setIsDark(dark);
        if (dark) document.documentElement.setAttribute("data-mode", "dark");
    }, []);

    const toggleDarkMode = () => {
        const newDark = !isDark;
        setIsDark(newDark);
        if (newDark) {
            document.documentElement.setAttribute("data-mode", "dark");
            localStorage.setItem("color-mode", "dark");
        } else {
            document.documentElement.removeAttribute("data-mode");
            localStorage.setItem("color-mode", "light");
        }
    };

    const defaultLinks = [
        { label: t('home'), href: "/", icon: "Home" },
        { label: t('store'), href: "/store", icon: "ShoppingCart" },
        { label: t('forum'), href: "/forum", icon: "MessageSquare" },
        { label: t('support'), href: "/support", icon: "HelpCircle" },
    ];
    const rawNavLinks = (Array.isArray(settings.navbar_links) ? settings.navbar_links : defaultLinks) as { label: string; href: string; icon?: string; children?: { label: string; href: string }[] }[];

    // Map href paths to module IDs for filtering disabled modules
    const pathToModule: Record<string, string> = {
        "/store": "store", "/forum": "forum", "/support": "support", "/blog": "blog",
        "/wheel": "wheel", "/vote": "vote", "/leaderboard": "leaderboard",
        "/suggestions": "suggestions", "/changelog": "changelog", "/staff": "staff",
        "/downloads": "downloads", "/punishments": "punishments",
    };
    const isLinkEnabled = (href: string) => {
        const moduleId = pathToModule[href];
        if (!moduleId) return true; // not a module link, always show
        return moduleStatus[moduleId] === true;
    };

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

    useEffect(() => {
        if (status !== "authenticated") return;
        if (moduleStatus['store'] === true) {
            fetch("/api/v1/store/cart").then((r) => r.json()).then((d) => setCartCount(d.itemCount || 0)).catch(() => {});
        }
        fetch("/api/v1/notifications").then((r) => r.json()).then((d) => setUnreadNotifs(d.unread || 0)).catch(() => {});
    }, [status, moduleStatus]);

    const isActive = (path: string) => path === "/" ? pathname === "/" : pathname.startsWith(path);
    const isAdminUser = session?.user?.role === "admin";

    return (
        <header className="bg-card border-b border-[var(--color-border)] sticky top-0 z-50">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-12">
                    <nav className="flex items-center gap-1">
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
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${navDropdown === link.label ? "text-primary bg-gray-50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"}`}
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
                                                                className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                                                                {ChildIcon && <ChildIcon className="w-4 h-4 text-gray-400" />}
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
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive(link.href) ? "text-primary" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"}`}>
                                    {IconComp && <IconComp className="w-4 h-4" />}
                                    {link.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="flex items-center gap-2">
                        {mounted && (
                            <button onClick={toggleDarkMode}
                                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </button>
                        )}

                        {status === "loading" ? (
                            <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
                        ) : session?.user ? (
                            <>
                                <Link href="/profile" className="relative p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                                    <Bell className="w-4 h-4" />
                                    {unreadNotifs > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>
                                    )}
                                </Link>
                                {moduleStatus['store'] === true && (
                                    <Link href="/store/cart" className="relative p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                                        <ShoppingCart className="w-4 h-4" />
                                        {cartCount > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white text-[10px] rounded-full flex items-center justify-center font-bold">{cartCount > 9 ? "9+" : cartCount}</span>
                                        )}
                                    </Link>
                                )}

                                <div className="relative" ref={menuRef}>
                                    <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors">
                                        {session.user.image ? (
                                            <img src={session.user.image} alt="" className="w-7 h-7 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                                                {(session.user.name || "U")[0].toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-sm font-medium text-gray-700 hidden sm:block">{session.user.name}</span>
                                    </button>

                                    {menuOpen && (
                                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50 animate-fade-in">
                                            <div className="px-3 py-2 border-b border-gray-100">
                                                <p className="text-sm font-medium text-gray-900 truncate">{session.user.name}</p>
                                                <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                                            </div>
                                            <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900" onClick={() => setMenuOpen(false)}>
                                                <User className="w-4 h-4" /> Profile
                                            </Link>
                                            {isAdminUser && (
                                                <Link href="/admin" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900" onClick={() => setMenuOpen(false)}>
                                                    <Shield className="w-4 h-4" /> Admin Panel
                                                </Link>
                                            )}
                                            <div className="border-t border-gray-100">
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
                                <Link href="/auth/login"><Button variant="ghost" size="sm" className="text-gray-600">{commonT('login')}</Button></Link>
                                <Link href="/auth/register"><Button size="sm">{commonT('register')}</Button></Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
