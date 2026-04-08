import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { listActions, listFilters, bootstrapHooks } from "@/core/lib/hooks";
import {
    ModuleHookListeners,
} from "@/core/generated/module-hooks";
import {
    ModuleSlotContents,
    ModuleContextProviders,
    ModuleNavbarComponents,
    ModuleFooterComponents,
    ModuleLayoutComponents,
    ModuleWidgets,
    ModuleProfileTabs,
    ModuleHomepageSections,
    ModuleSettingsCards,
    ModuleDashboardCards,
} from "@/core/generated/module-registry";

/**
 * Developer tools API: returns runtime introspection data for the
 * admin /dev page. Useful for debugging which modules contribute what
 * to the system at runtime.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Make sure hooks are bootstrapped before introspecting
    await bootstrapHooks();

    return NextResponse.json({
        hooks: {
            actions: listActions(),
            filters: listFilters(),
            registered: ModuleHookListeners.map((l) => ({
                hook: l.hook,
                type: l.type,
                module: l.module,
                priority: l.priority,
            })),
        },
        registries: {
            slotContents: ModuleSlotContents,
            contextProviders: ModuleContextProviders,
            navbarComponents: ModuleNavbarComponents,
            footerComponents: ModuleFooterComponents,
            layoutComponents: ModuleLayoutComponents,
            widgets: ModuleWidgets,
            profileTabs: ModuleProfileTabs,
            homepageSections: ModuleHomepageSections,
            settingsCards: ModuleSettingsCards,
            dashboardCards: ModuleDashboardCards,
        },
        runtime: {
            nodeVersion: process.version,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            env: process.env.NODE_ENV,
        },
    });
}
