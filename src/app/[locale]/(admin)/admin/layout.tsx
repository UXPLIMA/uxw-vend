
import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { AdminSidebar } from "@/core/components/admin/AdminSidebar";
import { AdminSearch } from "@/core/components/admin/AdminSearch";
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
        <div className="min-h-screen bg-gray-50">
            <AdminSidebar
                userName={session.user.name || ""}
                userEmail={session.user.email || ""}
                modules={modules}
            />
            {/* Main Content Wrapper */}
            <main className="lg:ml-64 p-4 pt-16 lg:pt-8 lg:p-8">
                <div className="mb-6 max-w-md">
                    <AdminSearch />
                </div>
                {children}
            </main>
        </div>
    );
}
