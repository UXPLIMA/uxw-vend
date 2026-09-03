
import React from "react";

interface SidebarLayoutProps {
    children: React.ReactNode;
    sidebar: React.ReactNode;
}

/**
 * Two-column page shell: content on the left, widgets on the right.
 *
 * The sidebar is allowed to render nothing. Widgets decide for themselves
 * whether they have anything to show (a "recent purchases" widget returns
 * null on a store with no orders), so a caller that passes a non-empty list
 * of widgets can still end up with an empty column. Reserving a third of the
 * page for it leaves the content visibly pushed to the left on a fresh
 * install. The `data-sidebar` / `data-sidebar-main` hooks let globals.css
 * collapse the column with `:empty` + `:has()` instead, which stays correct
 * when a widget fills in later on the client.
 */
export default function StandardSidebarLayout({ children, sidebar }: SidebarLayoutProps) {
    return (
        <div data-sidebar-layout className="grid lg:grid-cols-3 gap-6">
            <div data-sidebar-main className="lg:col-span-2">
                {children}
            </div>
            <div data-sidebar className="space-y-5">
                {sidebar}
            </div>
        </div>
    );
}
