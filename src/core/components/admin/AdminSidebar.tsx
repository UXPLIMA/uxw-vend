"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    HelpCircle
} from "lucide-react";

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { href: "/admin/modules", label: "Modules", icon: <Puzzle size={18} /> },
    { href: "/admin/store/products", label: "Products", icon: <Package size={18} /> },
    { href: "/admin/store/orders", label: "Orders", icon: <ShoppingCart size={18} /> },
    { href: "/admin/blog/articles", label: "Blog Articles", icon: <FileText size={18} /> },
    { href: "/admin/blog/categories", label: "Blog Categories", icon: <FolderOpen size={18} /> },
    { href: "/admin/tickets", label: "Support Tickets", icon: <Ticket size={18} /> },
    { href: "/admin/help", label: "Help Center", icon: <HelpCircle size={18} /> },
    { href: "/admin/users", label: "Users", icon: <Users size={18} /> },
    { href: "/admin/settings", label: "Settings", icon: <Settings size={18} /> },
];

interface AdminSidebarProps {
    userName?: string;
    userEmail?: string;
    modules?: any[]; // ModuleManifest[]
}

// Dynamic Icon Component
const DynamicIcon = ({ name, size = 18 }: { name: string; size?: number }) => {
    // Basic mapping for common icons
    const icons: Record<string, any> = {
        LayoutDashboard, Package, ShoppingCart, FileText, FolderOpen, Users,
        Settings, Puzzle, Ticket, HelpCircle
    };
    const Icon = icons[name] || Puzzle;
    return <Icon size={size} />;
};

export function AdminSidebar({ userName, userEmail, modules = [] }: AdminSidebarProps) {
    const pathname = usePathname();

    // Extract the path without locale
    // /en/admin/store/products -> /admin/store/products
    const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}/, "");

    const isActive = (href: string) => {
        if (href === "/admin") {
            return pathWithoutLocale === "/admin";
        }
        return pathWithoutLocale.startsWith(href);
    };

    // Merge core nav with module nav
    const coreNavItems = navItems.filter(item =>
        // Filter out static items that are now provided by modules if needed
        // For now, let's keep Dashboard, Modules, Users, Settings as Core
        ["Dashboard", "Modules", "Users", "Settings"].includes(item.label)
    );

    const moduleNavItems = modules.flatMap(module => {
        if (!module.menu) return [];
        return module.menu.map((menuItem: any) => ({
            href: `/admin${menuItem.path.startsWith('/') ? menuItem.path : '/' + menuItem.path}`,
            label: menuItem.label,
            icon: <DynamicIcon name={menuItem.icon || "Puzzle"} />,
            moduleId: module.id
        }));
    });

    const allNavItems = [
        coreNavItems[0], // Dashboard
        ...moduleNavItems,
        ...coreNavItems.slice(1) // Others
    ];

    return (
        <aside className="fixed top-0 left-0 bottom-0 w-64 bg-card p-4 border-r overflow-y-auto">
            <Link href="/" className="flex items-center gap-2 mb-8 px-2">
                <span className="font-bold text-xl">uxwVend</span>
            </Link>

            <nav className="space-y-1 mb-8">
                {allNavItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive(item.href)
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {item.icon}
                        {item.label}
                    </Link>
                ))}
            </nav>

            {userName && (
                <div className="absolute bottom-4 left-4 right-4 bg-background pt-2">
                    <div className="p-3 rounded-lg bg-muted">
                        <p className="text-sm font-medium truncate">{userName}</p>
                        {userEmail && (
                            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                        )}
                    </div>
                </div>
            )}
        </aside>
    );
}
