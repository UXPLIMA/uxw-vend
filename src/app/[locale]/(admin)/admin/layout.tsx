
import { auth } from "@/core/lib/auth";
import { AdminSidebar } from "@/core/components/admin/AdminSidebar";
import moduleSystem from "@/core/lib/modules";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    const modules = moduleSystem.getDefinitions();

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar
                userName={session?.user?.name || ""}
                userEmail={session?.user?.email || ""}
                modules={modules}
            />
            {/* Main Content Wrapper */}
            <main className="ml-64 p-8">
                {children}
            </main>
        </div>
    );
}
