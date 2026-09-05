import { prisma } from "@/core/lib/db";

/**
 * Per-admin dashboard layout.
 *
 * Persists which widgets are visible and in what order, keyed per user
 * via the Setting table. Falls back to a sensible default that shows
 * everything when no preference has been saved.
 *
 * Available widgets come from two sources:
 *   1. CORE_WIDGETS - hardcoded core list (users, activity, health, etc.)
 *   2. ModuleDashboardCards and ModuleDashboardSections - contributed from
 *      installed module manifests
 *
 * A widget listed here is a widget the dashboard actually obeys. That was not
 * true for a while: the customizer offered a module's cards and panels, saved
 * the answer, and the dashboard rendered every one of them anyway, because the
 * page only consulted the layout for its own five core widgets.
 *
 * Labels are keys, not sentences. These strings are read in the customizer,
 * which is a translated screen; `label` stays as the last-resort text for a
 * module that shipped no key.
 */

export interface DashboardWidget {
    id: string;
    visible: boolean;
    order: number;
}

export interface AvailableWidget {
    id: string;
    label: string;
    labelKey?: string;
    description?: string;
    descriptionKey?: string;
    source: "core" | "module";
    /** A stat card sits in the KPI row; a section is a full panel below it. */
    kind: "card" | "section";
    moduleId?: string;
}

export const CORE_WIDGETS: AvailableWidget[] = [
    { id: "users-count", label: "Users", labelKey: "widget_users", description: "Total registered users with 7-day delta", descriptionKey: "widget_usersDescription", source: "core", kind: "card" },
    { id: "activity-feed", label: "Activity feed", labelKey: "widget_activityFeed", description: "Five most recent public activity items", descriptionKey: "widget_activityFeedDescription", source: "core", kind: "card" },
    { id: "health-snapshot", label: "Health snapshot", labelKey: "widget_health", description: "Database, Redis, email queue, scheduler status", descriptionKey: "widget_healthDescription", source: "core", kind: "card" },
    { id: "recent-errors", label: "Recent errors", labelKey: "widget_recentErrors", description: "Latest cron job failures", descriptionKey: "widget_recentErrorsDescription", source: "core", kind: "card" },
    { id: "email-queue-status", label: "Email queue", labelKey: "widget_emailQueue", description: "Pending and failed email counts", descriptionKey: "widget_emailQueueDescription", source: "core", kind: "card" },
];

/** The layout id a module's card or panel is stored under. */
export function moduleWidgetId(kind: "card" | "section", moduleId: string, id: string): string {
    return kind === "section" ? `mod:${moduleId}:section:${id}` : `mod:${moduleId}:${id}`;
}

const SETTING_KEY_PREFIX = "dashboard_layout:";

function settingKey(userId: string): string {
    return `${SETTING_KEY_PREFIX}${userId}`;
}

/**
 * Returns every widget that can be added to the dashboard.
 * Core widgets + module dashboard card contributions.
 */
export async function getAvailableWidgets(): Promise<AvailableWidget[]> {
    const core: AvailableWidget[] = [...CORE_WIDGETS];
    try {
        const { ModuleDashboardCards, ModuleDashboardSections } = await import("@/core/generated/module-registry");
        const { getModuleStates } = await import("@/core/lib/module-cache");
        const { isEnabledIn } = await import("@/core/lib/module-enabled");
        // A disabled module's card cannot render, so listing it in the
        // customizer only offered the admin a widget that stays blank.
        const states = await getModuleStates();
        for (const card of ModuleDashboardCards) {
            if (!isEnabledIn(states, card.module)) continue;
            core.push({
                id: moduleWidgetId("card", card.module, card.id),
                label: card.label,
                labelKey: card.labelKey,
                source: "module",
                kind: "card",
                moduleId: card.module,
            });
        }
        for (const section of ModuleDashboardSections) {
            if (!isEnabledIn(states, section.module)) continue;
            core.push({
                id: moduleWidgetId("section", section.module, section.id),
                label: section.label,
                labelKey: section.labelKey,
                source: "module",
                kind: "section",
                moduleId: section.module,
            });
        }
    } catch {
        // Registry not available - only core widgets
    }
    return core;
}

/**
 * Returns the user's saved layout or a default (all visible, natural order).
 */
export async function getLayout(userId: string): Promise<DashboardWidget[]> {
    const available = await getAvailableWidgets();

    const row = await prisma.setting.findUnique({
        where: { key: settingKey(userId) },
    }).catch(() => null);

    let saved: DashboardWidget[] = [];
    if (row?.value && Array.isArray(row.value)) {
        saved = (row.value as unknown[]).filter((w): w is DashboardWidget =>
            typeof w === "object" && w !== null &&
            typeof (w as DashboardWidget).id === "string" &&
            typeof (w as DashboardWidget).visible === "boolean" &&
            typeof (w as DashboardWidget).order === "number"
        );
    }

    // Merge: keep saved preferences, add any new available widgets at the end as visible
    const savedIds = new Set(saved.map((w) => w.id));
    const nextOrder = saved.length > 0 ? Math.max(...saved.map((w) => w.order)) + 1 : 0;
    let order = nextOrder;
    for (const widget of available) {
        if (!savedIds.has(widget.id)) {
            saved.push({ id: widget.id, visible: true, order: order++ });
        }
    }

    // Drop any saved widgets that no longer exist in available (module uninstalled)
    const availableIds = new Set(available.map((w) => w.id));
    saved = saved.filter((w) => availableIds.has(w.id));

    // Default layout when nothing was saved: all visible, in declaration order
    if (saved.length === 0) {
        return available.map((w, i) => ({ id: w.id, visible: true, order: i }));
    }

    return saved.sort((a, b) => a.order - b.order);
}

/**
 * Persists the user's layout. Accepts an array of widgets with id/visible/order.
 */
export async function saveLayout(userId: string, widgets: DashboardWidget[]): Promise<void> {
    const available = await getAvailableWidgets();
    const availableIds = new Set(available.map((w) => w.id));
    const validated = widgets
        .filter((w) => availableIds.has(w.id))
        .map((w, i) => ({ id: w.id, visible: Boolean(w.visible), order: typeof w.order === "number" ? w.order : i }));

    await prisma.setting.upsert({
        where: { key: settingKey(userId) },
        create: {
            key: settingKey(userId),
            value: validated as unknown as object,
            module: "core",
        },
        update: {
            value: validated as unknown as object,
        },
    });
}

/**
 * Clears the user's saved layout so defaults are used on next load.
 */
export async function resetLayout(userId: string): Promise<void> {
    await prisma.setting.delete({
        where: { key: settingKey(userId) },
    }).catch(() => undefined);
}
