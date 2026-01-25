"use client";

import { Link, usePathname } from "@/core/lib/i18n/navigation";
import { Home, ShoppingCart, HelpCircle } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { useTranslations } from "next-intl";

export function Navbar() {
    const pathname = usePathname();
    const t = useTranslations('nav');
    const commonT = useTranslations('common');

    const isActive = (path: string) => {
        if (path === "/") return pathname === "/";
        return pathname.startsWith(path);
    };

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
                    </div>
                </div>
            </div>
        </header>
    );
}
