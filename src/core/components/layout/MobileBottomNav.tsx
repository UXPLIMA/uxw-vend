"use client";

import { Link, usePathname } from "@/core/lib/i18n/navigation";
import { Home, ShoppingCart, MessageSquare, HelpCircle, User } from "lucide-react";
import { useSession } from "next-auth/react";

const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/store", icon: ShoppingCart, label: "Store" },
    { href: "/forum", icon: MessageSquare, label: "Forum" },
    { href: "/support", icon: HelpCircle, label: "Support" },
    { href: "/profile", icon: User, label: "Profile" },
];

export function MobileBottomNav() {
    const pathname = usePathname();
    const { data: session } = useSession();

    // Don't show on admin pages
    if (pathname.startsWith("/admin")) return null;

    const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
            <div className="flex items-center justify-around h-14">
                {navItems.map((item) => {
                    if (item.href === "/profile" && !session?.user) return null;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center gap-0.5 px-3 py-1 ${isActive(item.href) ? "text-primary" : "text-gray-400"}`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
