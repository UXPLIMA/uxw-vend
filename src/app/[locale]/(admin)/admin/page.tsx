import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { getTranslations } from "next-intl/server";
import { DashboardClient } from "./components/dashboard-client";
import { DashboardCustomizer } from "@/core/components/admin/DashboardCustomizer";
import { getLayout, getAvailableWidgets } from "@/core/lib/dashboard-layout";
import UsersCountWidget from "@/core/components/admin/widgets/UsersCountWidget";
import ActivityFeedWidget from "@/core/components/admin/widgets/ActivityFeedWidget";
import HealthSnapshotWidget from "@/core/components/admin/widgets/HealthSnapshotWidget";
import RecentErrorsWidget from "@/core/components/admin/widgets/RecentErrorsWidget";
import EmailQueueStatusWidget from "@/core/components/admin/widgets/EmailQueueStatusWidget";
import TopTrophiesWidget from "@/core/components/admin/widgets/TopTrophiesWidget";

export const dynamic = "force-dynamic";

// Map core widget ids to their server components. Module widget ids
// (prefixed with "mod:") still render via the existing DashboardClient
// which fetches each module's statsApi at runtime.
const CORE_WIDGET_COMPONENTS: Record<string, () => React.ReactNode> = {
    "users-count": () => <UsersCountWidget key="users-count" />,
    "activity-feed": () => <ActivityFeedWidget key="activity-feed" />,
    "health-snapshot": () => <HealthSnapshotWidget key="health-snapshot" />,
    "recent-errors": () => <RecentErrorsWidget key="recent-errors" />,
    "email-queue-status": () => <EmailQueueStatusWidget key="email-queue-status" />,
    "top-trophies": () => <TopTrophiesWidget key="top-trophies" />,
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

    return (
        <>
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">{t("dashboard_title")}</h1>
                    <p className="text-xs text-muted-foreground">{t("dashboard_welcomeBack", { name: session.user.name })}</p>
                </div>
                <DashboardCustomizer />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {visible.map((w) => {
                    const info = availableById.get(w.id);
                    if (!info || info.source !== "core") return null;
                    const render = CORE_WIDGET_COMPONENTS[w.id];
                    return render ? render() : null;
                })}

                {/* Module cards rendered client-side from module stats APIs */}
                <DashboardClient />
            </div>
        </>
    );
}
