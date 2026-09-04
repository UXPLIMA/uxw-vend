"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Palette, Paintbrush, Globe, Navigation, PanelBottom, Image, LayoutGrid, Code, Settings, Package, Shield, ShieldOff, ShieldAlert, Mail, MessageSquare, BarChart, DollarSign, Server, Download, Target, Webhook, Bell, Gauge, FileJson, History, ShieldCheck, AlertTriangle, Activity, Clock, Inbox, Award, Database, ScrollText, Wrench } from "lucide-react";
import { Link } from "@/core/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { ModuleWidgets } from "@/core/generated/module-registry";
import { useAllModules } from "@/core/providers/module-provider";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Palette, Paintbrush, Globe, Navigation, PanelBottom, Image, LayoutGrid, Code, Settings, Package,
    Shield, ShieldOff, ShieldAlert, Mail, MessageSquare, BarChart, DollarSign, Server, Download, Target, Webhook, Bell, Gauge, FileJson,
    History, ShieldCheck, AlertTriangle, Activity, Clock, Inbox, Award, Database, ScrollText, Wrench,
};

export default function SettingsPage() {
    const t = useTranslations("admin");
    const modules = useAllModules();

    // Sidebar widgets are contributed by modules. With none installed the page
    // behind this card is an empty list, so the card itself does not appear.
    const hasWidgets = ModuleWidgets.some((w) => modules[w.module] === true);

    // Core settings - always visible
    const coreSettings = [
        { title: t("settings_general"), description: t("settings_generalDesc"), href: "/admin/settings/general", icon: "Settings", color: "text-slate-500" },
        { title: t("settings_appearance"), description: t("settings_appearanceDesc"), href: "/admin/settings/theme", icon: "Palette", color: "text-purple-500" },
        { title: t("settings_navbar"), description: t("settings_navbarDesc"), href: "/admin/settings/navbar", icon: "Navigation", color: "text-blue-500" },
        { title: t("settings_footer"), description: t("settings_footerDesc"), href: "/admin/settings/footer", icon: "PanelBottom", color: "text-gray-500" },
        ...(hasWidgets
            ? [{ title: t("settings_widgets"), description: t("settings_widgetsDesc"), href: "/admin/settings/widgets", icon: "LayoutGrid", color: "text-teal-500" }]
            : []),
        { title: t("settings_customCss"), description: t("settings_customCssDesc"), href: "/admin/settings/css", icon: "Code", color: "text-yellow-500" },
        { title: t("settings_siteConfig"), description: t("settings_siteConfigDesc"), href: "/admin/settings/site", icon: "Globe", color: "text-blue-400" },
        {
            title: t("settings_rateLimits"),
            description: t("settings_rateLimitsDesc"),
            href: "/admin/settings/rate-limits",
            icon: "Gauge",
            color: "text-indigo-500",
        },
        {
            title: t("settings_apiDocs"),
            description: t("settings_apiDocsDesc"),
            href: "/admin/api-docs",
            icon: "FileJson",
            color: "text-emerald-500",
        },
        {
            title: t("settings_revisions"),
            description: t("settings_revisionsDesc"),
            href: "/admin/revisions",
            icon: "History",
            color: "text-cyan-500",
        },
        {
            title: t("settings_resourcePermissions"),
            description: t("settings_resourcePermissionsDesc"),
            href: "/admin/resource-permissions",
            icon: "ShieldCheck",
            color: "text-lime-500",
        },
        {
            title: t("settings_warnings"),
            description: t("settings_warningsDesc"),
            href: "/admin/warnings",
            icon: "AlertTriangle",
            color: "text-amber-500",
        },
        {
            title: t("settings_broadcasts"),
            description: t("settings_broadcastsDesc"),
            href: "/admin/broadcasts",
            icon: "Mail",
            color: "text-rose-500",
        },
        {
            title: t("settings_cronJobs"),
            description: t("settings_cronJobsDesc"),
            href: "/admin/cron",
            icon: "Clock",
            color: "text-amber-500",
        },
        {
            title: t("settings_emailQueue"),
            description: t("settings_emailQueueDesc"),
            href: "/admin/email-queue",
            icon: "Inbox",
            color: "text-cyan-500",
        },
        {
            title: t("settings_observability"),
            description: t("settings_observabilityDesc"),
            href: "/admin/observability",
            icon: "Activity",
            color: "text-emerald-500",
        },
        {
            title: t("settings_backup"),
            description: t("settings_backupDesc"),
            href: "/admin/backup",
            icon: "Database",
            color: "text-sky-500",
        },
        {
            title: t("settings_auditLog"),
            description: t("settings_auditLogDesc"),
            href: "/admin/audit-log",
            icon: "ScrollText",
            color: "text-orange-500",
        },
        {
            title: t("settings_ipBlocks"),
            description: t("settings_ipBlocksDesc"),
            href: "/admin/ip-blocks",
            icon: "ShieldOff",
            color: "text-red-600",
        },
        {
            title: t("settings_alerting"),
            description: t("settings_alertingDesc"),
            href: "/admin/settings/alerting",
            icon: "Bell",
            color: "text-amber-500",
        },
        {
            title: t("settings_maintenance"),
            description: t("settings_maintenanceDesc"),
            href: "/admin/settings/maintenance",
            icon: "Wrench",
            color: "text-yellow-600",
        },
        {
            title: t("settings_moderation"),
            description: t("settings_moderationDesc"),
            href: "/admin/moderation",
            icon: "ShieldAlert",
            color: "text-rose-500",
        },
    ];

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
            </div>
        </div>
    );
}
