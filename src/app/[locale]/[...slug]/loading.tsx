import { SkeletonHeroBanner, SkeletonNavbar, SkeletonNewsGrid, SkeletonSidebar } from "@/core/components/ui/skeleton";
import { ThemeSlot } from "@/core/components/theme-slot";
import StandardSidebarLayout from "@/core/components/layout/SidebarLayout";
import { Footer } from "@/core/components/layout";

export default function Loading() {
    return (
        <div className="min-h-screen flex flex-col">
            {/* Shared Hero Banner */}
            <SkeletonHeroBanner />

            {/* Shared Navbar */}
            <SkeletonNavbar />

            {/* Main Content */}
            <main className="container mx-auto px-4 py-6 flex-1">
                <StandardSidebarLayout
                    sidebar={<SkeletonSidebar />}
                    children={<SkeletonNewsGrid count={4} />}
                />
            </main>

            {/* Shared Footer */}
            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
