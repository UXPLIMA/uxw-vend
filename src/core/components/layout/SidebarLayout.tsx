
import React from "react";

interface SidebarLayoutProps {
    children: React.ReactNode;
    sidebar: React.ReactNode;
}

export default function StandardSidebarLayout({ children, sidebar }: SidebarLayoutProps) {
    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                {children}
            </div>
            <div className="space-y-5">
                {sidebar}
            </div>
        </div>
    );
}
