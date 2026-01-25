
import React from "react";

interface SidebarLayoutProps {
    children: React.ReactNode;
    sidebar: React.ReactNode;
}

export default function RetroSidebarLayout({ children, sidebar }: SidebarLayoutProps) {
    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="order-2 lg:order-1 lg:col-span-1 space-y-5">
                <div className="p-4 bg-yellow-400 border-4 border-black font-bold text-center mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    DEVICE_WIDGETS
                </div>
                {sidebar}
            </div>
            <div className="order-1 lg:order-2 lg:col-span-2">
                {children}
            </div>
        </div>
    );
}
