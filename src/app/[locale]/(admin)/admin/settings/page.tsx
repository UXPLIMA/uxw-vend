"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Palette, Globe, Navigation, PanelBottom, Image, LayoutGrid, Code, Settings, Package, Shield, Mail, MessageSquare, BarChart, DollarSign, Server, Download, Target, Webhook, Bell } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAllModules } from "@/core/providers/module-provider";
import { ModuleSettingsCards } from "@/core/generated/module-registry";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Palette, Globe, Navigation, PanelBottom, Image, LayoutGrid, Code, Settings, Package,
    Shield, Mail, MessageSquare, BarChart, DollarSign, Server, Download, Target, Webhook, Bell,
};

export default function SettingsPage() {
    const t = useTranslations("admin");
    const modules = useAllModules();

    // Core settings — always visible
    const coreSettings = [
        { title: t("settings_general"), description: t("settings_generalDesc"), href: "/admin/settings/general", icon: "Settings", color: "text-slate-500" },
        { title: t("settings_appearance"), description: t("settings_appearanceDesc"), href: "/admin/settings/theme", icon: "Palette", color: "text-purple-500" },
        { title: t("settings_navbar"), description: t("settings_navbarDesc"), href: "/admin/settings/navbar", icon: "Navigation", color: "text-blue-500" },
        { title: t("settings_footer"), description: t("settings_footerDesc"), href: "/admin/settings/footer", icon: "PanelBottom", color: "text-gray-500" },
        { title: t("settings_heroBanner"), description: t("settings_heroBannerDesc"), href: "/admin/settings/hero", icon: "Image", color: "text-pink-500" },
        { title: t("settings_widgets"), description: t("settings_widgetsDesc"), href: "/admin/settings/widgets", icon: "LayoutGrid", color: "text-teal-500" },
        { title: t("settings_customCss"), description: t("settings_customCssDesc"), href: "/admin/settings/css", icon: "Code", color: "text-yellow-500" },
        { title: t("settings_siteConfig"), description: t("settings_siteConfigDesc"), href: "/admin/settings/site", icon: "Globe", color: "text-blue-400" },
    ];

    // Module settings cards — only from enabled modules
    const moduleCards = ModuleSettingsCards.filter(sc => modules[sc.module] === true);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t("settings_title")}</h1>
                <p className="text-muted-foreground">{t("settings_subtitle")}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {coreSettings.map((item) => {
                    const Icon = iconMap[item.icon] || Package;
                    return (
                        <Link href={item.href} key={item.href}>
                            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                                <CardHeader className="p-4">
                                    <CardTitle className="flex items-center space-x-2 text-sm">
                                        <Icon className={`w-4 h-4 ${item.color}`} />
                                        <span>{item.title}</span>
                                    </CardTitle>
                                    <CardDescription className="text-xs">{item.description}</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    );
                })}

                {moduleCards.map((item) => {
                    const Icon = iconMap[item.icon] || Package;
                    return (
                        <Link href={`/admin${item.href}`} key={item.href}>
                            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full border-dashed">
                                <CardHeader className="p-4">
                                    <CardTitle className="flex items-center space-x-2 text-sm">
                                        <Icon className={`w-4 h-4 ${item.color}`} />
                                        <span>{item.title}</span>
                                    </CardTitle>
                                    <CardDescription className="text-xs">{item.description}</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
