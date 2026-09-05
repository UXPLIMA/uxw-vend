import { redirect } from "@/core/lib/i18n/navigation";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { getLocale, getTranslations } from "next-intl/server";
import {
    DashboardKpiRow,
    ModuleSections,
} from "./components/dashboard-client";
import { DashboardCustomizer } from "@/core/components/admin/DashboardCustomizer";
import { getLayout, getAvailableWidgets } from "@/core/lib/dashboard-layout";
import UsersCountWidget from "@/core/components/admin/widgets/UsersCountWidget";
import ActivityFeedWidget from "@/core/components/admin/widgets/ActivityFeedWidget";
import HealthSnapshotWidget from "@/core/components/admin/widgets/HealthSnapshotWidget";
import RecentErrorsWidget from "@/core/components/admin/widgets/RecentErrorsWidget";
import EmailQueueStatusWidget from "@/core/components/admin/widgets/EmailQueueStatusWidget";

export const dynamic = "force-dynamic";

/*
 * Admin dashboard - grouped into distinct visual sections so the grid
 * stays uniform and nothing orphans on its own row.
 *
 *   ┌─ Header ────────────────────────────────────────┐
 *   │ Title + Customize                               │
 *   ├─ KPI row ───────────────────────────────────────┤
 *   │ [ Users ] [ Health ] [ Email ] [ Errors ]       │ <- core 1x1 cards
 *   │ + module-contributed stat cards (same row)      │
 *   ├─ Panels row ────────────────────────────────────┤
 *   │ [ Activity feed      ]                          │ <- 2-col panels
 *   ├─ Module sections ───────────────────────────────┤
 *   │ [ Open tickets       ] [ Latest orders ]        │ <- module-contributed
 *   │ [ Recent forum topics ... ]                     │
 *   ├─ Analytics ─────────────────────────────────────┤
 *   │ [         Users chart, full width        ]      │
 *   └─────────────────────────────────────────────────┘
 *
 * Widgets are grouped by shape:
 *  - KPI:    users-count, health-snapshot, email-queue-status,
 *            recent-errors  (1x1)
 *  - Panels: activity-feed (1x1 but larger cards)
 */

const PANEL_WIDGET_IDS = new Set(["activity-feed"]);

const WIDGET_COMPONENTS: Record<string, () => React.ReactNode> = {
    "users-count": () => <UsersCountWidget key="users-count" />,
    "activity-feed": () => <ActivityFeedWidget key="activity-feed" />,
    "health-snapshot": () => <HealthSnapshotWidget key="health-snapshot" />,
    "recent-errors": () => <RecentErrorsWidget key="recent-errors" />,
    "email-queue-status": () => <EmailQueueStatusWidget key="email-queue-status" />,
};

export default async function AdminDashboard() {
    const session = await auth();
    const locale = await getLocale();
    if (!session?.user) redirect({ href: "/auth/login", locale });
    if (!(await isAdmin(session.user.id))) redirect({ href: "/", locale });

    const t = await getTranslations("admin");
    const [layout, available] = await Promise.all([
        getLayout(session.user.id),
        getAvailableWidgets(),
    ]);

    const visible = layout.filter((w) => w.visible);
    const availableById = new Map(available.map((a) => [a.id, a]));

    const renderWidget = (id: string) => {
        const info = availableById.get(id);
        if (!info || info.source !== "core") return null;
        const render = WIDGET_COMPONENTS[id];
        return render ? render() : null;
    };

    const visiblePanelWidgets = visible.filter((w) => PANEL_WIDGET_IDS.has(w.id));

    // The KPI row mixes core widgets with module stat cards, and the customizer
    // lets an admin order and hide either. The core widgets are rendered here,
    // on the server, and handed to the row as nodes; the row fetches the module
    // cards itself and places both in the saved order.
    const kpiOrder = visible
        .filter((w) => {
            const info = availableById.get(w.id);
            return Boolean(info) && info!.kind === "card" && !PANEL_WIDGET_IDS.has(w.id);
        })
        .map((w) => w.id);
    const coreSlots: Record<string, React.ReactNode> = {};
    for (const id of kpiOrder) {
        const node = renderWidget(id);
        if (node) coreSlots[id] = node;
    }

    // Section panels are hidden by plain id; the row ids carry the module.
    const hiddenSections = layout
        .filter((w) => !w.visible && availableById.get(w.id)?.kind === "section")
        .map((w) => w.id.split(":section:")[1])
        .filter(Boolean);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">{t("dashboard_title")}</h1>
                    <p className="text-xs text-muted-foreground">{t("dashboard_welcomeBack", { name: session.user.name })}</p>
                </div>
                <DashboardCustomizer />
            </div>

            {/* KPI row - core KPIs + module stat cards, uniform 1x1 grid */}
            {kpiOrder.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <DashboardKpiRow order={kpiOrder} coreSlots={coreSlots} />
                </div>
            )}

            {/* Panel row - larger activity/engagement cards */}
            {visiblePanelWidgets.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {visiblePanelWidgets.map((w) => renderWidget(w.id))}
                </div>
            )}

            {/* Module sections - 2-col panels contributed by modules */}
            <ModuleSections hidden={hiddenSections} />
        </div>
    );
}
