"use client";

import { Link, usePathname } from "@/core/lib/i18n/navigation";
import { Home, User, Package } from "lucide-react";
import { useSession } from "next-auth/react";
import { useAllModules } from "@/core/providers/module-provider";
import { ModuleNavLinks } from "@/core/generated/module-registry";

// Icon map for dynamic rendering from registry
import { ShoppingCart, MessageSquare, HelpCircle, FileText, Star, Download, Gift, Crown, Trophy, Vote, Dices, History, Users, Shield } from "lucide-react";
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Home, ShoppingCart, MessageSquare, HelpCircle, FileText, Star, Download,
    Gift, Crown, Trophy, Vote, Dices, History, Users, Shield, Package, User,
};

export function MobileBottomNav() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const moduleStatus = useAllModules();

    if (pathname.startsWith("/admin")) return null;

    // Build nav items from registry — Home + first 3 enabled module links + Profile
    const moduleLinks = ModuleNavLinks
        .filter(nl => moduleStatus[nl.module] === true)
        .slice(0, 3)
        .map(nl => ({
            href: nl.href,
            icon: iconMap[nl.icon || "Package"] || Package,
            label: nl.label,
        }));

    const items = [
        { href: "/", icon: Home, label: "Home" },
        ...moduleLinks,
        ...(session?.user ? [{ href: "/profile", icon: User, label: "Profile" }] : []),
    ];

    const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
            <div className="flex items-center justify-around h-14">
                {items.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex flex-col items-center gap-0.5 px-3 py-1 ${isActive(item.href) ? "text-primary" : "text-muted-foreground"}`}
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </Link>
                ))}
            </div>
        </nav>
    );
}
