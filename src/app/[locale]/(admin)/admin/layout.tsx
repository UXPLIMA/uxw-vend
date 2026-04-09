
import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { AdminSidebar } from "@/core/components/admin/AdminSidebar";
import { AdminSearch } from "@/core/components/admin/AdminSearch";
import { AdminSpotlight } from "@/core/components/admin/AdminSpotlight";
import { AdminBreadcrumb } from "@/core/components/admin/AdminBreadcrumb";
import { ModuleUpdateBadge } from "@/core/components/admin/ModuleUpdateBadge";
import { UpdateNotificationBanner } from "@/core/components/admin/UpdateNotificationBanner";
import moduleSystem from "@/core/lib/modules";
import { prisma } from "@/core/lib/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    if (!session?.user) {
        redirect("/auth/login");
    }

    const admin = await isAdmin(session.user.id);
    if (!admin) {
        redirect("/");
    }

    // Initialize module states from DB so isEnabled() works correctly
    const dbModuleConfigs = await prisma.moduleConfig.findMany();
    await moduleSystem.initialize(
        dbModuleConfigs.map((mc) => ({
            id: mc.id,
            enabled: mc.enabled,
            config: mc.config as Record<string, unknown>,
        }))
    );

    const modules = moduleSystem.getEnabledModules();

    return (
        <div className="min-h-screen bg-background" suppressHydrationWarning>
            <AdminSidebar
                userName={session.user.name || ""}
                userEmail={session.user.email || ""}
                modules={modules}
            />
            {/* Main content — cleared 56 (icon rail) + 224 (context sidebar) = 280px */}
            <main
                id="main-content"
                tabIndex={-1}
                className="lg:ml-[280px] min-h-screen bg-background flex flex-col"
            >
                <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-sm border-b border-border">
                    <div className="flex items-center justify-between gap-4 px-4 lg:px-6 h-14 pl-16 lg:pl-6">
                        <AdminBreadcrumb />
                        <div className="flex items-center gap-3">
                            <div className="hidden md:block w-64">
                                <AdminSearch />
                            </div>
                            <ModuleUpdateBadge />
                        </div>
                    </div>
                </header>
                <div className="flex-1 p-4 lg:p-6">
                    <UpdateNotificationBanner />
                    {children}
                </div>
            </main>
            <AdminSpotlight />
        </div>
    );
}
