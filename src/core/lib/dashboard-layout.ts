import { prisma } from "@/core/lib/db";

/**
 * Per-admin dashboard layout.
 *
 * Persists which widgets are visible and in what order, keyed per user
 * via the Setting table. Falls back to a sensible default that shows
 * everything when no preference has been saved.
 *
 * Available widgets come from two sources:
 *   1. CORE_WIDGETS — hardcoded core list (users, activity, health, etc.)
 *   2. ModuleDashboardCards — contributed from installed module manifests
 */

export interface DashboardWidget {
    id: string;
    visible: boolean;
    order: number;
}

export interface AvailableWidget {
    id: string;
    label: string;
    description?: string;
    source: "core" | "module";
    moduleId?: string;
}

export const CORE_WIDGETS: AvailableWidget[] = [
    { id: "users-count", label: "Users", description: "Total registered users with 7-day delta", source: "core" },
    { id: "activity-feed", label: "Activity feed", description: "Five most recent public activity items", source: "core" },
    { id: "health-snapshot", label: "Health snapshot", description: "Database, Redis, email queue, scheduler status", source: "core" },
    { id: "recent-errors", label: "Recent errors", description: "Latest cron job failures", source: "core" },
    { id: "email-queue-status", label: "Email queue", description: "Pending and failed email counts", source: "core" },
    { id: "top-trophies", label: "Top trophies", description: "Three rarest trophies on the platform", source: "core" },
];

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
        const { ModuleDashboardCards } = await import("@/core/generated/module-registry");
        for (const card of ModuleDashboardCards) {
            core.push({
                id: `mod:${card.module}:${card.id}`,
                label: card.label,
                source: "module",
                moduleId: card.module,
            });
        }
    } catch {
        // Registry not available — only core widgets
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
