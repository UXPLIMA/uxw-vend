"use client";

import { Link, usePathname } from "@/core/lib/i18n/navigation";
import { Home, ShoppingCart, HelpCircle, MessageSquare, User, LogOut, Shield, Star, Download, Gift, Crown, FileText, Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { useSiteSettings } from "@/core/hooks/useSiteSettings";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Home, ShoppingCart, HelpCircle, MessageSquare, Star, Download, Gift, Crown, FileText,
};

export default function MinecraftNavbar() {
    const pathname = usePathname();
    const t = useTranslations('nav');
    const commonT = useTranslations('common');
    const { data: session, status } = useSession();
    const [menuOpen, setMenuOpen] = useState(false);
    const [cartCount, setCartCount] = useState(0);
    const { settings } = useSiteSettings();
    const menuRef = useRef<HTMLDivElement>(null);

    const defaultLinks = [
        { label: t('home'), href: "/", icon: "Home" },
        { label: t('store'), href: "/store", icon: "ShoppingCart" },
        { label: t('forum'), href: "/forum", icon: "MessageSquare" },
        { label: t('support'), href: "/support", icon: "HelpCircle" },
    ];
    const navLinks = (Array.isArray(settings.navbar_links) ? settings.navbar_links : defaultLinks) as { label: string; href: string; icon?: string }[];

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
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
        <header className="sticky top-0 z-50" style={{ background: "#242424", borderBottom: "3px solid #3ea72d" }}>
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-14">
                    {/* Logo */}
                    <Link href="/" style={{ fontFamily: "'Press Start 2P', monospace", color: "#3ea72d", fontSize: "14px", textTransform: "uppercase", letterSpacing: "2px" }}>
                        uxwVend
                    </Link>

                    {/* Nav Links */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => {
                            const IconComp = link.icon ? iconMap[link.icon] : null;
                            return (
                                <Link key={link.href} href={link.href}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold uppercase tracking-wider transition-colors"
                                    style={{
                                        color: isActive(link.href) ? "#3ea72d" : "#8c8c8c",
                                        borderBottom: isActive(link.href) ? "2px solid #3ea72d" : "2px solid transparent",
                                    }}>
                                    {IconComp && <IconComp className="w-4 h-4" />}
                                    {link.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right Side */}
                    <div className="flex items-center gap-2">
                        {status === "loading" ? (
                            <div className="w-8 h-8 rounded bg-[#333] animate-pulse" />
                        ) : session?.user ? (
                            <>
                                <Link href="/store/cart" className="relative p-2 rounded text-[#8c8c8c] hover:text-white transition-colors">
                                    <ShoppingCart className="w-4 h-4" />
                                    {cartCount > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] rounded-sm flex items-center justify-center font-bold" style={{ background: "#3ea72d", color: "#fff" }}>
                                            {cartCount > 9 ? "9+" : cartCount}
                                        </span>
                                    )}
                                </Link>

                                <div className="relative" ref={menuRef}>
                                    <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#333] transition-colors">
                                        <div className="w-7 h-7 rounded-sm flex items-center justify-center text-xs font-bold" style={{ background: "#3ea72d", color: "#fff" }}>
                                            {(session.user.name || "U")[0].toUpperCase()}
                                        </div>
                                        <span className="text-sm font-medium text-[#ccc] hidden sm:block">{session.user.name}</span>
                                    </button>

                                    {menuOpen && (
                                        <div className="absolute right-0 top-full mt-1 w-48 py-1 z-50 rounded-sm" style={{ background: "#2a2a2a", border: "1px solid #3a3a3a" }}>
                                            <div className="px-3 py-2" style={{ borderBottom: "1px solid #3a3a3a" }}>
                                                <p className="text-sm font-medium text-white truncate">{session.user.name}</p>
                                                <p className="text-xs text-[#8c8c8c] truncate">{session.user.email}</p>
                                            </div>
                                            <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-[#8c8c8c] hover:text-white hover:bg-[#333]" onClick={() => setMenuOpen(false)}>
                                                <User className="w-4 h-4" /> Profile
                                            </Link>
                                            {isAdminUser && (
                                                <Link href="/admin" className="flex items-center gap-2 px-3 py-2 text-sm text-[#8c8c8c] hover:text-white hover:bg-[#333]" onClick={() => setMenuOpen(false)}>
                                                    <Shield className="w-4 h-4" /> Admin
                                                </Link>
                                            )}
                                            <button onClick={() => signOut({ callbackUrl: "/" })} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 w-full text-left">
                                                <LogOut className="w-4 h-4" /> {commonT('logout')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link href="/auth/login">
                                    <button className="px-4 py-2 text-sm font-bold text-[#ccc] hover:text-white uppercase tracking-wider transition-colors">
                                        {commonT('login')}
                                    </button>
                                </Link>
                                <Link href="/auth/register">
                                    <button className="px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-sm transition-colors" style={{ background: "#3ea72d", color: "#fff", border: "none", borderBottom: "3px solid #2d7a20" }}>
                                        {commonT('register')}
                                    </button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
