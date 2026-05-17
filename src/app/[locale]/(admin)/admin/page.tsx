import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { getTranslations } from "next-intl/server";
import {
    ModuleStatCards,
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
 * Admin dashboard — grouped into distinct visual sections so the grid
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

const KPI_WIDGET_IDS = new Set([
    "users-count",
    "health-snapshot",
    "email-queue-status",
    "recent-errors",
]);
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
    if (!session?.user) redirect("/auth/login");
    if (!(await isAdmin(session.user.id))) redirect("/");

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

    const visibleKpiWidgets = visible.filter((w) => KPI_WIDGET_IDS.has(w.id));
    const visiblePanelWidgets = visible.filter((w) => PANEL_WIDGET_IDS.has(w.id));

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

            {/* KPI row — core KPIs + module stat cards, uniform 1x1 grid */}
            {(visibleKpiWidgets.length > 0 || true) && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {visibleKpiWidgets.map((w) => renderWidget(w.id))}
                    <ModuleStatCards />
                </div>
            )}

            {/* Panel row — larger activity/engagement cards */}
            {visiblePanelWidgets.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {visiblePanelWidgets.map((w) => renderWidget(w.id))}
                </div>
            )}

            {/* Module sections — 2-col panels contributed by modules */}
            <ModuleSections />
        </div>
    );
}
