"use client";

import { Link, usePathname } from "@/core/lib/i18n/navigation";
import { Home, ShoppingCart, HelpCircle, MessageSquare, User, LogOut, Shield, Sun, Moon, Star, Download, Gift, Crown, FileText } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/core/components/ui/button";
import { useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Home, ShoppingCart, HelpCircle, MessageSquare, Star, Download, Gift, Crown, FileText,
};

export function Navbar() {
    const pathname = usePathname();
    const t = useTranslations('nav');
    const commonT = useTranslations('common');
    const { data: session, status } = useSession();
    const [menuOpen, setMenuOpen] = useState(false);
    const [cartCount, setCartCount] = useState(0);
    const { theme, setTheme } = useTheme();
    const { settings } = useSiteSettings();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const defaultLinks = [
        { label: t('home'), href: "/", icon: "Home" },
        { label: t('store'), href: "/store", icon: "ShoppingCart" },
        { label: t('forum'), href: "/forum", icon: "MessageSquare" },
        { label: t('support'), href: "/support", icon: "HelpCircle" },
    ];
    const navLinks = (Array.isArray(settings.navbar_links) ? settings.navbar_links : defaultLinks) as { label: string; href: string; icon?: string }[];
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (status !== "authenticated") return;
        fetch("/api/v1/store/cart").then((r) => r.json()).then((d) => setCartCount(d.itemCount || 0)).catch(() => {});
    }, [status]);

    const isActive = (path: string) => path === "/" ? pathname === "/" : pathname.startsWith(path);
    const isAdminUser = session?.user?.role === "admin";

    return (
        <header className="glass sticky top-0 z-50 border-b border-white/5">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-14">
                    <nav className="flex items-center gap-0.5">
                        {navLinks.map((link) => {
                            const IconComp = link.icon ? iconMap[link.icon] : null;
                            return (
                                <Link key={link.href} href={link.href}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive(link.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
                                    {IconComp && <IconComp className="w-4 h-4" />}
                                    <span className="hidden sm:inline">{link.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="flex items-center gap-2">
                        {mounted && (
                            <button onClick={() => setTheme(theme === "dark" || theme === "flat" ? "light" : "flat")}
                                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
                                {theme === "dark" || theme === "flat" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </button>
                        )}

                        {status === "loading" ? (
                            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                        ) : session?.user ? (
                            <>
                                <Link href="/store/cart" className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
                                    <ShoppingCart className="w-4 h-4" />
                                    {cartCount > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-black text-[10px] rounded-full flex items-center justify-center font-bold">{cartCount > 9 ? "9+" : cartCount}</span>
                                    )}
                                </Link>

                                <div className="relative" ref={menuRef}>
                                    <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all">
                                        {session.user.image ? (
                                            <img src={session.user.image} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-primary/20" />
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-black text-xs font-bold">
                                                {(session.user.name || "U")[0].toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-sm font-medium hidden sm:block">{session.user.name}</span>
                                    </button>

                                    {menuOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-52 glass rounded-xl shadow-2xl shadow-black/30 py-1 z-50 border border-white/10 animate-fade-in">
                                            <div className="px-4 py-3 border-b border-white/5">
                                                <p className="text-sm font-medium truncate">{session.user.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                                            </div>
                                            <Link href="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors" onClick={() => setMenuOpen(false)}>
                                                <User className="w-4 h-4" /> Profile
                                            </Link>
                                            {isAdminUser && (
                                                <Link href="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors" onClick={() => setMenuOpen(false)}>
                                                    <Shield className="w-4 h-4" /> Admin Panel
                                                </Link>
                                            )}
                                            <div className="border-t border-white/5 mt-1">
                                                <button onClick={() => signOut({ callbackUrl: "/" })} className="flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 w-full text-left transition-colors">
                                                    <LogOut className="w-4 h-4" /> {commonT('logout')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link href="/auth/login"><Button variant="ghost" size="sm">{commonT('login')}</Button></Link>
                                <Link href="/auth/register"><Button size="sm">{commonT('register')}</Button></Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
