"use client";

import { useState } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { usePathname } from "@/core/lib/i18n/navigation";
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
    MessageSquare
} from "lucide-react";

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { href: "/admin/modules", label: "Modules", icon: <Puzzle size={18} /> },
    { href: "/admin/announcements", label: "Announcements", icon: <Megaphone size={18} /> },
    { href: "/admin/changelog", label: "Changelog", icon: <History size={18} /> },
    { href: "/admin/popups", label: "Popups", icon: <Bell size={18} /> },
    { href: "/admin/downloads", label: "Downloads", icon: <Download size={18} /> },
    { href: "/admin/gift-codes", label: "Gift Codes", icon: <Gift size={18} /> },
    { href: "/admin/creator-codes", label: "Creator Codes", icon: <Tag size={18} /> },
    { href: "/admin/vote-sites", label: "Vote Sites", icon: <Vote size={18} /> },
    { href: "/admin/wheel-prizes", label: "Wheel Prizes", icon: <Dices size={18} /> },
    { href: "/admin/forms", label: "Custom Forms", icon: <FileEdit size={18} /> },
    { href: "/admin/bulk-discounts", label: "Bulk Discounts", icon: <Percent size={18} /> },
    { href: "/admin/staff-members", label: "Staff Members", icon: <UserCheck size={18} /> },
    { href: "/admin/staff-applications", label: "Applications", icon: <FileText size={18} /> },
    { href: "/admin/slider", label: "Slider", icon: <ImageIcon size={18} /> },
    { href: "/admin/seo", label: "SEO", icon: <Search size={18} /> },
    { href: "/admin/webhook-logs", label: "Webhook Logs", icon: <Webhook size={18} /> },
    { href: "/admin/activity-log", label: "Activity Log", icon: <ScrollText size={18} /> },
    { href: "/admin/servers", label: "Game Servers", icon: <Server size={18} /> },
    { href: "/admin/users", label: "Users", icon: <Users size={18} /> },
    { href: "/admin/roles", label: "Roles", icon: <Shield size={18} /> },
    { href: "/admin/settings", label: "Settings", icon: <Settings size={18} /> },
];

interface AdminSidebarProps {
    userName?: string;
    userEmail?: string;
    modules?: any[];
}

const DynamicIcon = ({ name, size = 18 }: { name: string; size?: number }) => {
    const icons: Record<string, any> = {
        LayoutDashboard, Package, ShoppingCart, FileText, FolderOpen, Users,
        Settings, Puzzle, Ticket, HelpCircle, Tag, Megaphone, History,
        UserCheck, Gift, Download, Vote, Dices, Percent, ImageIcon, Search,
        Webhook, ScrollText, Server, Bell, FileEdit, Shield, Menu, X,
        MessageSquare,
    };
    const Icon = icons[name] || Package;
    return <Icon size={size} />;
};

export function AdminSidebar({ userName, userEmail, modules = [] }: AdminSidebarProps) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const isActive = (href: string) => {
        if (href === "/admin") return pathname === "/admin";
        return pathname.startsWith(href);
    };

    const moduleNavItems = modules.flatMap(module => {
        if (!module.menu) return [];
        return module.menu.map((menuItem: any) => ({
            href: `/admin${menuItem.path.startsWith('/') ? menuItem.path : '/' + menuItem.path}`,
            label: menuItem.label,
            icon: <DynamicIcon name={menuItem.icon || "Puzzle"} />,
            moduleId: module.id
        }));
    });

    // Dashboard first, then module menus, then rest of core items
    const allNavItems = [
        navItems[0], // Dashboard
        ...moduleNavItems,
        ...navItems.slice(1),
    ];

    const sidebarContent = (
        <>
            <Link href="/" className="flex items-center mb-8 px-3" onClick={() => setMobileOpen(false)}>
                <span className="font-bold text-xl text-gray-900">uxwVend</span>
            </Link>

            <nav className="space-y-0.5 mb-8 px-1">
                {allNavItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`admin-sidebar-link flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isActive(item.href)
                            ? "active"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {item.icon}
                        {item.label}
                    </Link>
                ))}
            </nav>

        </>
    );

    return (
        <>
            {/* Mobile hamburger button */}
            <button
                onClick={() => setMobileOpen(true)}
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
            <aside className={`lg:hidden fixed top-0 left-0 bottom-0 w-64 admin-sidebar p-4 overflow-y-auto z-50 transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <button
                    onClick={() => setMobileOpen(false)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
                >
                    <X size={18} />
                </button>
                {sidebarContent}
            </aside>

            {/* Desktop sidebar */}
            <aside className="hidden lg:block fixed top-0 left-0 bottom-0 w-64 admin-sidebar p-4 overflow-y-auto">
                {sidebarContent}
            </aside>
        </>
    );
}
