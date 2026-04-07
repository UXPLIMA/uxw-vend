"use client";

import { useState } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { usePathname } from "@/core/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { useDarkMode } from "@/core/hooks/useDarkMode";
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    FileText,
    FolderOpen,
    Users,
    Settings,
    Puzzle,
    Ticket,
    HelpCircle,
    Shield,
    Menu,
    X,
    Tag,
    Megaphone,
    History,
    UserCheck,
    Gift,
    Download,
    Vote,
    Dices,
    Percent,
    ImageIcon,
    Search,
    Webhook,
    ScrollText,
    Server,
    Bell,
    FileEdit,
    MessageSquare,
    LayoutList,
    Layers,
    Crown,
    ClipboardCheck,
    KeyRound,
    Trophy,
    Sun,
    Moon,
} from "lucide-react";

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

// Core nav item definitions (labels resolved at render time via i18n)
const coreNavDefs = [
    { href: "/admin", labelKey: "sidebar_dashboard", icon: <LayoutDashboard size={18} /> },
    { href: "/admin/modules", labelKey: "sidebar_modules", icon: <Puzzle size={18} /> },
] as const;

const coreToolDefs = [
    { href: "/admin/seo", labelKey: "sidebar_seo", icon: <Search size={18} /> },
    { href: "/admin/users", labelKey: "sidebar_users", icon: <Users size={18} /> },
    { href: "/admin/roles", labelKey: "sidebar_roles", icon: <Shield size={18} /> },
    { href: "/admin/settings", labelKey: "sidebar_settings", icon: <Settings size={18} /> },
    { href: "/admin/system", labelKey: "sidebar_systemHealth", icon: <Server size={18} /> },
    { href: "/admin/activity-log", labelKey: "sidebar_activityLog", icon: <ScrollText size={18} /> },
    { href: "/admin/api-keys", labelKey: "sidebar_apiKeys", icon: <KeyRound size={18} /> },
] as const;

interface AdminSidebarProps {
    userName?: string;
    userEmail?: string;
    modules?: { id: string; menu?: { path: string; label: string; icon?: string }[] }[];
}

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
    LayoutDashboard, Package, ShoppingCart, FileText, FolderOpen, Users,
    Settings, Puzzle, Ticket, HelpCircle, Tag, Megaphone, History,
    UserCheck, Gift, Download, Vote, Dices, Percent, ImageIcon, Search,
    Webhook, ScrollText, Server, Bell, FileEdit, Shield, Menu, X,
    MessageSquare, LayoutList, Layers, Crown, ClipboardCheck, KeyRound, Trophy,
};

const DynamicIcon = ({ name, size = 18 }: { name: string; size?: number }) => {
    const Icon = iconMap[name] || Package;
    return <Icon size={size} />;
};

export function AdminSidebar({ modules = [] }: AdminSidebarProps) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const { isDark, toggle: toggleDarkMode } = useDarkMode();
    const t = useTranslations("admin");

    const isActive = (href: string) => {
        if (href === "/admin") return pathname === "/admin";
        return pathname.startsWith(href);
    };

    // Resolve core nav items with translated labels
    const coreNavItems: NavItem[] = coreNavDefs.map(d => ({
        href: d.href, label: t(d.labelKey), icon: d.icon,
    }));

    const coreToolItems: NavItem[] = coreToolDefs.map(d => ({
        href: d.href, label: t(d.labelKey), icon: d.icon,
    }));

    // Build module menu items — try translated label, fall back to manifest label
    const moduleNavItems: NavItem[] = modules.flatMap(module => {
        if (!module.menu) return [];
        return module.menu.map((menuItem) => {
            // Try to get translated menu label from module's translation namespace
            let label = menuItem.label;
            try { const translated = t(`menu_${module.id}`); if (translated && !translated.startsWith("admin.menu_")) label = translated; } catch { /* fallback */ }
            return {
                href: `/admin${menuItem.path.startsWith('/') ? menuItem.path : '/' + menuItem.path}`,
                label,
                icon: <DynamicIcon name={menuItem.icon || "Puzzle"} />,
            };
        });
    });

    // Combine: core nav + module menus + core tools
    const allNavItems: NavItem[] = [
        ...coreNavItems,
        ...moduleNavItems,
        ...coreToolItems,
    ];

    const sidebarContent = (
        <>
            <Link href="/" className="flex items-center mb-8 px-3" onClick={() => setMobileOpen(false)}>
                <span className="font-bold text-xl text-foreground">uxwVend</span>
            </Link>

            <nav className="space-y-0.5 mb-8 px-1 flex-1">
                {allNavItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`admin-sidebar-link flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isActive(item.href) ? "active" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        {item.icon}
                        {item.label}
                    </Link>
                ))}
            </nav>

            {/* Dark mode toggle */}
            <div className="px-1 mt-auto pt-4 border-t border-border">
                <button
                    onClick={toggleDarkMode}
                    className="admin-sidebar-link flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full text-muted-foreground hover:text-foreground"
                >
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    {isDark ? t("sidebar_lightMode") : t("sidebar_darkMode")}
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile hamburger button */}
            <button
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-card border shadow-sm flex items-center justify-center"
            >
                <Menu size={20} />
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Mobile sidebar */}
            <aside className={`lg:hidden fixed top-0 left-0 bottom-0 w-64 admin-sidebar p-4 overflow-y-auto z-50 transition-transform duration-200 flex flex-col ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <button
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close menu"
                    className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
                >
                    <X size={18} />
                </button>
                {sidebarContent}
            </aside>

            {/* Desktop sidebar */}
            <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-64 admin-sidebar p-4 overflow-y-auto">
                {sidebarContent}
            </aside>
        </>
    );
}
