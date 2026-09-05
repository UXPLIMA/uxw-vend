"use client";

import { useState, useEffect } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Package } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import { useAllModules } from "@/core/providers/module-provider";
import dynamic from "next/dynamic";
import { isEnabledIn } from "@/core/lib/module-enabled";
import { useSiteCurrency } from "@/core/components/currency/site-currency";
import { badgeClassName, type BadgeTone } from "@/core/components/ui/badge";

const DashboardCharts = dynamic(() => import("./dashboard-charts").then(m => ({ default: m.DashboardCharts })), {
    loading: () => <div className="h-[300px] bg-muted animate-pulse rounded-lg" />,
});

interface ModuleManifest {
    id: string;
    statsApi?: string;
    dashboardCards?: DashboardCard[];
}

function toKebab(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function CardIcon({ name, className }: { name: string; className?: string }) {
    if (!name) return <Package className={className} />;
    return (
        <DynamicIcon
            name={toKebab(name) as React.ComponentProps<typeof DynamicIcon>["name"]}
            className={className}
            fallback={() => <Package className={className} />}
        />
    );
}

// A module names a colour in its manifest, from a fixed list. They map onto
// the badge's tones rather than onto Tailwind's palette, so a module's badge
// follows the theme like every other one.
const badgeTones: Record<string, BadgeTone> = {
    green: "success",
    yellow: "warning",
    blue: "info",
    red: "danger",
    gray: "neutral",
};

interface DashboardCard {
    id: string;
    label: string;
    labelKey?: string;
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
    titleKey?: string;
    viewAllHref?: string;
    items: SectionItem[];
}

/**
 * Shared data-fetch hook - one call to /api/v1/modules + each enabled
 * module's statsApi endpoint. All three dashboard subcomponents below
 * read from the same hook so we only hit the network once per render.
 */
function useModuleDashboardData() {
    const modules = useAllModules();
    const [cards, setCards] = useState<DashboardCard[]>([]);
    const [stats, setStats] = useState<Record<string, string | number>>({});
    const [sections, setSections] = useState<DashboardSection[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/v1/modules")
            .then(r => r.json())
            .then(async (data) => {
                if (cancelled) return;
                const enabledModules = ((data.modules || []) as ModuleManifest[]).filter((m) => isEnabledIn(modules, m.id));

                const allCards: DashboardCard[] = [];
                const allStats: Record<string, string | number> = {};
                const allSections: DashboardSection[] = [];

                const fetches = enabledModules
                    .filter((m) => m.statsApi)
                    .map(async (m) => {
                        try {
                            const res = await fetch(`/api/v1${m.statsApi}`);
                            if (!res.ok) return;
                            const d = await res.json();
                            if (d.stats) Object.assign(allStats, d.stats);
                            if (d.sections) allSections.push(...d.sections);
                        } catch { /* skip failed module */ }
                    });

                await Promise.all(fetches);

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
            .catch(() => {
                if (cancelled) return;
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [modules]);

    return { cards, stats, sections, loading };
}

function formatValue(
    key: string,
    value: string | number | undefined,
    money: (amount: number | string | null | undefined) => string,
): string | number {
    if (value === undefined) return 0;
    // A module's revenue card is denominated in whatever the gateways charge
    // in. This used to write it with a dollar sign whatever that was.
    if (key === "revenue") return money(value);
    return value || 0;
}

/** The layout id a module card or panel is stored under. Mirrors core. */
function widgetId(kind: "card" | "section", moduleId: string, id: string): string {
    return kind === "section" ? `mod:${moduleId}:section:${id}` : `mod:${moduleId}:${id}`;
}

function StatCardSkeleton() {
    return (
        <Card className="animate-pulse">
            <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-20 mb-2" />
                <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
        </Card>
    );
}

/**
 * The KPI row.
 *
 * `order` names the core cards in the order the page wants them; `coreSlots`
 * carries those cards, rendered on the server and handed down as nodes,
 * because the row itself fetches the module cards and appends them after.
 */
export function DashboardKpiRow({ order, coreSlots }: {
    order: string[];
    coreSlots: Record<string, React.ReactNode>;
}) {
    const { cards, stats, loading } = useModuleDashboardData();
    const t = useTranslations("admin");
    const { format: money } = useSiteCurrency();

    const translateLabel = (raw: string, key?: string): string => {
        if (!key) return raw;
        try {
            const translated = t(key);
            return translated && translated !== key ? translated : raw;
        } catch {
            return raw;
        }
    };

    const byId = new Map(cards.map((card) => [widgetId("card", card.module, card.id), card]));

    return (
        <>
            {order.map((id) => {
                if (coreSlots[id]) return <div key={id}>{coreSlots[id]}</div>;
                if (!id.startsWith("mod:")) return null;
                const card = byId.get(id);
                if (!card) return loading ? <StatCardSkeleton key={id} /> : null;
                return (
                    <Link key={id} href={card.href} className="block">
                        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        {translateLabel(card.label, card.labelKey)}
                                    </span>
                                    <CardIcon name={card.icon} className={`w-4 h-4 ${card.color}`} />
                                </div>
                                <div className="text-2xl font-bold">{formatValue(card.statKey, stats[card.statKey], money)}</div>
                            </CardContent>
                        </Card>
                    </Link>
                );
            })}
        </>
    );
}

/**
 * Flat list of module-contributed stat cards, every one of them. Kept for the
 * legacy `DashboardClient` wrapper below.
 */
export function ModuleStatCards() {
    const { cards } = useModuleDashboardData();
    return (
        <DashboardKpiRow
            order={cards.map((card) => widgetId("card", card.module, card.id))}
            coreSlots={{}}
        />
    );
}

/**
 * Module-contributed section panels (e.g. open tickets, latest orders,
 * recent forum topics). Rendered as a 2-col grid of larger Cards.
 */
export function ModuleSections() {
    const { sections, loading } = useModuleDashboardData();
    const t = useTranslations("admin");

    const translateLabel = (raw: string, key?: string): string => {
        if (!key) return raw;
        try {
            const translated = t(key);
            return translated && translated !== key ? translated : raw;
        } catch {
            return raw;
        }
    };

    if (loading || sections.length === 0) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {sections.map((section) => (
                <Card key={section.id}>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base">{translateLabel(section.title, section.titleKey)}</CardTitle>
                            {section.viewAllHref && (
                                <Link href={section.viewAllHref} className="text-xs text-primary hover:underline">
                                    {t("dashboard_viewAll")}
                                </Link>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {section.items.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4 text-sm">{t("dashboard_noData")}</p>
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
                                                    <span className={badgeClassName(badgeTones[item.badgeColor || "gray"] ?? "neutral")}>
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
    );
}

/**
 * Analytics chart strip, full-width.
 */
export function DashboardAnalytics() {
    const t = useTranslations("admin");
    return (
        <div>
            <h2 className="text-lg font-semibold mb-3">{t("dashboard_analytics")}</h2>
            <DashboardCharts />
        </div>
    );
}

/**
 * Legacy wrapper - still exported for components that import it directly.
 * New dashboard layout composes the three pieces independently.
 */
export function DashboardClient() {
    return (
        <>
            <ModuleStatCards />
            <div className="col-span-full mt-4">
                <ModuleSections />
            </div>
            <div className="col-span-full mt-4">
                <DashboardAnalytics />
            </div>
        </>
    );
}
