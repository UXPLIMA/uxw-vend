"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Palette, Paintbrush, Globe, Navigation, PanelBottom, Image, LayoutGrid, Code, Settings, Package, Shield, ShieldOff, ShieldAlert, Mail, MessageSquare, BarChart, DollarSign, Server, Download, Target, Webhook, Bell, Gauge, FileJson, History, ShieldCheck, AlertTriangle, Activity, Clock, Inbox, Award, Database, ScrollText, Wrench } from "lucide-react";
import { Link } from "@/core/lib/i18n/navigation";
import { useTranslations } from "next-intl";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Palette, Paintbrush, Globe, Navigation, PanelBottom, Image, LayoutGrid, Code, Settings, Package,
    Shield, ShieldOff, ShieldAlert, Mail, MessageSquare, BarChart, DollarSign, Server, Download, Target, Webhook, Bell, Gauge, FileJson,
    History, ShieldCheck, AlertTriangle, Activity, Clock, Inbox, Award, Database, ScrollText, Wrench,
};

export default function SettingsPage() {
    const t = useTranslations("admin");

    // Core settings — always visible
    const coreSettings = [
        { title: t("settings_general"), description: t("settings_generalDesc"), href: "/admin/settings/general", icon: "Settings", color: "text-slate-500" },
        { title: t("settings_appearance"), description: t("settings_appearanceDesc"), href: "/admin/settings/theme", icon: "Palette", color: "text-purple-500" },
        { title: t("settings_navbar"), description: t("settings_navbarDesc"), href: "/admin/settings/navbar", icon: "Navigation", color: "text-blue-500" },
        { title: t("settings_footer"), description: t("settings_footerDesc"), href: "/admin/settings/footer", icon: "PanelBottom", color: "text-gray-500" },
        { title: t("settings_widgets"), description: t("settings_widgetsDesc"), href: "/admin/settings/widgets", icon: "LayoutGrid", color: "text-teal-500" },
        { title: t("settings_customCss"), description: t("settings_customCssDesc"), href: "/admin/settings/css", icon: "Code", color: "text-yellow-500" },
        { title: t("settings_siteConfig"), description: t("settings_siteConfigDesc"), href: "/admin/settings/site", icon: "Globe", color: "text-blue-400" },
        {
            title: t.has("settings_rateLimits") ? t("settings_rateLimits") : "Rate Limits",
            description: t.has("settings_rateLimitsDesc") ? t("settings_rateLimitsDesc") : "Per-role API rate limit multipliers.",
            href: "/admin/settings/rate-limits",
            icon: "Gauge",
            color: "text-indigo-500",
        },
        {
            title: t.has("settings_apiDocs") ? t("settings_apiDocs") : "API Docs",
            description: t.has("settings_apiDocsDesc") ? t("settings_apiDocsDesc") : "Interactive OpenAPI reference for core and module endpoints.",
            href: "/admin/api-docs",
            icon: "FileJson",
            color: "text-emerald-500",
        },
        {
            title: t.has("settings_revisions") ? t("settings_revisions") : "Revision History",
            description: t.has("settings_revisionsDesc") ? t("settings_revisionsDesc") : "Audit trail of every content update and delete.",
            href: "/admin/revisions",
            icon: "History",
            color: "text-cyan-500",
        },
        {
            title: t.has("settings_resourcePermissions") ? t("settings_resourcePermissions") : "Resource Permissions",
            description: t.has("settings_resourcePermissionsDesc") ? t("settings_resourcePermissionsDesc") : "Granular per-entity allow/deny access grants.",
            href: "/admin/resource-permissions",
            icon: "ShieldCheck",
            color: "text-lime-500",
        },
        {
            title: t.has("settings_warnings") ? t("settings_warnings") : "User Warnings",
            description: t.has("settings_warningsDesc") ? t("settings_warningsDesc") : "Issue and review moderator warnings.",
            href: "/admin/warnings",
            icon: "AlertTriangle",
            color: "text-amber-500",
        },
        {
            title: t.has("settings_broadcasts") ? t("settings_broadcasts") : "Email Broadcasts",
            description: t.has("settings_broadcastsDesc") ? t("settings_broadcastsDesc") : "Compose and send bulk email to users.",
            href: "/admin/broadcasts",
            icon: "Mail",
            color: "text-rose-500",
        },
        {
            title: t.has("settings_cronJobs") ? t("settings_cronJobs") : "Cron Jobs",
            description: t.has("settings_cronJobsDesc") ? t("settings_cronJobsDesc") : "Monitor scheduled jobs and run history",
            href: "/admin/cron",
            icon: "Clock",
            color: "text-amber-500",
        },
        {
            title: t.has("settings_emailQueue") ? t("settings_emailQueue") : "Email Queue",
            description: t.has("settings_emailQueueDesc") ? t("settings_emailQueueDesc") : "Background email delivery queue",
            href: "/admin/email-queue",
            icon: "Inbox",
            color: "text-cyan-500",
        },
        {
            title: t.has("settings_observability") ? t("settings_observability") : "Observability",
            description: t.has("settings_observabilityDesc") ? t("settings_observabilityDesc") : "Platform health and metrics",
            href: "/admin/observability",
            icon: "Activity",
            color: "text-emerald-500",
        },
        {
            title: t.has("settings_backup") ? t("settings_backup") : "Backup",
            description: t.has("settings_backupDesc") ? t("settings_backupDesc") : "Database backup & restore",
            href: "/admin/backup",
            icon: "Database",
            color: "text-sky-500",
        },
        {
            title: t.has("settings_auditLog") ? t("settings_auditLog") : "Audit Log",
            description: t.has("settings_auditLogDesc") ? t("settings_auditLogDesc") : "Review sensitive admin actions",
            href: "/admin/audit-log",
            icon: "ScrollText",
            color: "text-orange-500",
        },
        {
            title: t.has("settings_ipBlocks") ? t("settings_ipBlocks") : "IP Blocks",
            description: t.has("settings_ipBlocksDesc") ? t("settings_ipBlocksDesc") : "Ban specific IPs or CIDR ranges from the site or admin panel.",
            href: "/admin/ip-blocks",
            icon: "ShieldOff",
            color: "text-red-600",
        },
        {
            title: t.has("settings_alerting") ? t("settings_alerting") : "Health Alerting",
            description: t.has("settings_alertingDesc") ? t("settings_alertingDesc") : "Send Discord or Slack notifications when the platform degrades.",
            href: "/admin/settings/alerting",
            icon: "Bell",
            color: "text-amber-500",
        },
        {
            title: t.has("settings_maintenance") ? t("settings_maintenance") : "Maintenance Mode",
            description: t.has("settings_maintenanceDesc") ? t("settings_maintenanceDesc") : "Take the site offline for visitors while admins keep access.",
            href: "/admin/settings/maintenance",
            icon: "Wrench",
            color: "text-yellow-600",
        },
        {
            title: t.has("settings_moderation") ? t("settings_moderation") : "Moderation",
            description: t.has("settings_moderationDesc") ? t("settings_moderationDesc") : "Review pending comments, topics, and suggestions.",
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
