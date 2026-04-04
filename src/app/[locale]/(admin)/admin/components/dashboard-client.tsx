"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Loader2, Package, ShoppingCart, DollarSign, FileText, MessageSquare, Ticket, Trophy, Vote, Dices, History, Download, Megaphone, Users, Shield } from "lucide-react";
import { useAllModules } from "@/core/providers/module-provider";
import { DashboardCharts } from "./dashboard-charts";

const iconMap: Record<string, any> = {
    Package, ShoppingCart, DollarSign, FileText, MessageSquare, Ticket,
    Trophy, Vote, Dices, History, Download, Megaphone, Users, Shield,
};

const badgeColors: Record<string, string> = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-500",
};

interface DashboardCard {
    id: string;
    label: string;
    icon: string;
    href: string;
    color: string;
    statKey: string;
    module: string;
}

interface SectionItem {
    id: string;
    href?: string;
    primary: string;
    secondary?: string;
    badge?: string;
    badgeColor?: string;
    value?: string;
}

interface DashboardSection {
    id: string;
    title: string;
    viewAllHref?: string;
    items: SectionItem[];
}

export function DashboardClient() {
    const modules = useAllModules();
    const [cards, setCards] = useState<DashboardCard[]>([]);
    const [stats, setStats] = useState<Record<string, any>>({});
    const [sections, setSections] = useState<DashboardSection[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch module list to get dashboardCards and statsApi from manifests
        fetch("/api/v1/modules")
            .then(r => r.json())
            .then(async (data) => {
                const enabledModules = (data.modules || []).filter((m: any) => modules[m.id] === true);

                // Collect dashboard cards from enabled modules
                const allCards: DashboardCard[] = [];
                const allStats: Record<string, any> = {};
                const allSections: DashboardSection[] = [];

                // Fetch stats from each module's statsApi
                const fetches = enabledModules
                    .filter((m: any) => m.statsApi)
                    .map(async (m: any) => {
                        try {
                            const res = await fetch(`/api/v1${m.statsApi}`);
                            if (!res.ok) return;
                            const d = await res.json();
                            if (d.stats) Object.assign(allStats, d.stats);
                            if (d.sections) allSections.push(...d.sections);
                        } catch { /* skip failed module */ }
                    });

                await Promise.all(fetches);

                // Collect cards
                for (const m of enabledModules) {
                    if (m.dashboardCards) {
                        for (const card of m.dashboardCards) {
                            allCards.push({ ...card, module: m.id });
                        }
                    }
                }

                setCards(allCards);
                setStats(allStats);
                setSections(allSections);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [modules]);

    if (loading) {
        return (
            <>
                {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-4">
                            <div className="h-4 bg-muted rounded w-20 mb-2" />
                            <div className="h-8 bg-muted rounded w-16" />
                        </CardContent>
                    </Card>
                ))}
            </>
        );
    }

    const formatValue = (key: string, value: any) => {
        if (key === "revenue") return `$${Number(value || 0).toFixed(2)}`;
        return value || 0;
    };

    return (
        <>
            {/* Stat cards from modules */}
            {cards.map((card) => {
                const Icon = iconMap[card.icon] || Package;
                return (
                    <Link key={card.id} href={card.href}>
                        <Card className="hover:shadow-md transition-shadow cursor-pointer">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</span>
                                    <Icon className={`w-4 h-4 ${card.color}`} />
                                </div>
                                <div className="text-2xl font-bold">{formatValue(card.statKey, stats[card.statKey])}</div>
                            </CardContent>
                        </Card>
                    </Link>
                );
            })}

            {/* Close the grid from parent, render sections below */}
            <div className="col-span-full" />

            {/* Sections from modules */}
            {sections.length > 0 && (
                <div className="col-span-full grid lg:grid-cols-2 gap-6 mt-2">
                    {sections.map((section) => (
                        <Card key={section.id}>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-base">{section.title}</CardTitle>
                                    {section.viewAllHref && (
                                        <Link href={section.viewAllHref} className="text-xs text-primary hover:underline">View All</Link>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {section.items.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-4 text-sm">No data</p>
                                ) : (
                                    <div className="space-y-2">
                                        {section.items.map((item) => {
                                            const content = (
                                                <div className="flex justify-between items-center p-3 rounded-lg hover:bg-muted/50 transition-colors text-sm">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium truncate">{item.primary}</p>
                                                        {item.secondary && <p className="text-xs text-muted-foreground">{item.secondary}</p>}
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                                        {item.value && <span className="font-bold text-sm">{item.value}</span>}
                                                        {item.badge && (
                                                            <span className={`text-xs px-2 py-0.5 rounded ${badgeColors[item.badgeColor || "gray"]}`}>
                                                                {item.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                            return item.href ? (
                                                <Link key={item.id} href={item.href}>{content}</Link>
                                            ) : (
                                                <div key={item.id}>{content}</div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Charts */}
            <div className="col-span-full mt-4">
                <h2 className="text-xl font-bold mb-4">Analytics</h2>
                <DashboardCharts />
            </div>
        </>
    );
}
