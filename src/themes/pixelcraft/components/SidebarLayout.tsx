"use client";

export default function PixelCraftSidebarLayout({ children, sidebar }: { children: React.ReactNode; sidebar: React.ReactNode }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">{children}</div>
            <div className="space-y-4">{sidebar}</div>
        </div>
    );
}
