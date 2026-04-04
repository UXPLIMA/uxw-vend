import { Card, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Palette, Globe, Navigation, PanelBottom, Image, LayoutGrid, Code, Settings } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
    const settingsItems = [
        { title: "General", description: "Pagination, limits, business rules, and automation settings.", href: "/admin/settings/general", icon: Settings, color: "text-slate-500" },
        { title: "Appearance", description: "Themes and layout.", href: "/admin/settings/theme", icon: Palette, color: "text-purple-500" },
        { title: "Navbar", description: "Navigation menu links and order.", href: "/admin/settings/navbar", icon: Navigation, color: "text-blue-500" },
        { title: "Footer", description: "Footer content and links.", href: "/admin/settings/footer", icon: PanelBottom, color: "text-gray-500" },
        { title: "Hero Banner", description: "Background, logo, server IP.", href: "/admin/settings/hero", icon: Image, color: "text-pink-500" },
        { title: "Widgets", description: "Sidebar widget visibility and order.", href: "/admin/settings/widgets", icon: LayoutGrid, color: "text-teal-500" },
        { title: "Custom CSS", description: "Inject custom styles.", href: "/admin/settings/css", icon: Code, color: "text-yellow-500" },
        { title: "Site Config", description: "Name, description, social links.", href: "/admin/settings/site", icon: Globe, color: "text-blue-400" },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-muted-foreground">Manage your platform settings and configurations.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {settingsItems.map((item) => (
                    <Link href={item.href} key={item.href}>
                        <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                            <CardHeader className="p-4">
                                <CardTitle className="flex items-center space-x-2 text-sm">
                                    <item.icon className={`w-4 h-4 ${item.color}`} />
                                    <span>{item.title}</span>
                                </CardTitle>
                                <CardDescription className="text-xs">{item.description}</CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
