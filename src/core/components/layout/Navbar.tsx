"use client";

import { Link, usePathname } from "@/core/lib/i18n/navigation";
import { Home, ShoppingCart, HelpCircle, MessageSquare, User, LogOut, Shield } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

export function Navbar() {
    const pathname = usePathname();
    const t = useTranslations('nav');
    const commonT = useTranslations('common');
    const { data: session, status } = useSession();
    const [menuOpen, setMenuOpen] = useState(false);
    const [cartCount, setCartCount] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetch cart count for logged-in users
    useEffect(() => {
        if (status !== "authenticated") return;
        fetch("/api/v1/store/cart")
            .then((r) => r.json())
            .then((d) => setCartCount(d.itemCount || 0))
            .catch(() => {});
    }, [status]);

    const isActive = (path: string) => {
        if (path === "/") return pathname === "/";
        return pathname.startsWith(path);
    };

    const isAdmin = session?.user?.role === "admin";

    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between py-3">
                    <nav className="flex items-center gap-1">
                        <Link
                            href="/"
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive("/")
                                ? "bg-blue-50 text-blue-600"
                                : "text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            <Home className="w-4 h-4" /> {t('home')}
                        </Link>
                        <Link
                            href="/store"
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive("/store")
                                ? "bg-blue-50 text-blue-600"
                                : "text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            <ShoppingCart className="w-4 h-4" /> {t('store')}
                        </Link>
                        <Link
                            href="/forum"
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive("/forum")
                                ? "bg-blue-50 text-blue-600"
                                : "text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            <MessageSquare className="w-4 h-4" /> {t('forum')}
                        </Link>
                        <Link
                            href="/support"
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive("/support")
                                ? "bg-blue-50 text-blue-600"
                                : "text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            <HelpCircle className="w-4 h-4" /> {t('support')}
                        </Link>
                    </nav>

                    <div className="flex items-center gap-3">
                        {status === "loading" ? (
                            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
                        ) : session?.user ? (
                            <>
                            {/* Cart Badge */}
                            <Link
                                href="/store/cart"
                                className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                <ShoppingCart className="w-5 h-5" />
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                                        {cartCount > 9 ? "9+" : cartCount}
                                    </span>
                                )}
                            </Link>
                            <div className="relative" ref={menuRef}>
                                <button
                                    onClick={() => setMenuOpen(!menuOpen)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    {session.user.image ? (
                                        <img
                                            src={session.user.image}
                                            alt={session.user.name || ""}
                                            className="w-7 h-7 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                                            {(session.user.name || "U")[0].toUpperCase()}
                                        </div>
                                    )}
                                    <span className="text-sm font-medium text-gray-700 hidden sm:block">
                                        {session.user.name}
                                    </span>
                                </button>

                                {menuOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                        <div className="px-3 py-2 border-b border-gray-100">
                                            <p className="text-sm font-medium text-gray-900 truncate">{session.user.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                                        </div>
                                        <Link
                                            href="/profile"
                                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                            onClick={() => setMenuOpen(false)}
                                        >
                                            <User className="w-4 h-4" /> Profile
                                        </Link>
                                        {isAdmin && (
                                            <Link
                                                href="/admin"
                                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                onClick={() => setMenuOpen(false)}
                                            >
                                                <Shield className="w-4 h-4" /> Admin Panel
                                            </Link>
                                        )}
                                        <button
                                            onClick={() => signOut({ callbackUrl: "/" })}
                                            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                                        >
                                            <LogOut className="w-4 h-4" /> {commonT('logout')}
                                        </button>
                                    </div>
                                )}
                            </div>
                            </>
                        ) : (
                            <>
                                <Link href="/auth/login">
                                    <Button variant="ghost" className="text-gray-700 hover:bg-gray-100 hover:text-gray-900 px-5 py-2">
                                        {commonT('login')}
                                    </Button>
                                </Link>
                                <Link href="/auth/register">
                                    <Button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-sm">
                                        {commonT('register')}
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
