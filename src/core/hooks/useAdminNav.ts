"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import * as LucideIcons from "lucide-react";
import { Package } from "lucide-react";
import { ModuleNavGroups } from "@/core/generated/module-registry";
import {
    buildNavGroups,
    buildThemeNavGroup,
    type NavGroup,
    type NavIconComponent,
} from "@/core/lib/admin-nav-groups";

/**
 * The admin navigation, built once and read by everything that names a page.
 *
 * The sidebar built it and the breadcrumb did not, which is why the sidebar
 * said "Ödeme Ayarları" while the breadcrumb above it said "Payments" - the
 * breadcrumb was titlecasing the URL segment. Every label the panel can show
 * for a route already exists in these groups, translated, so both read them
 * from here.
 */

export interface AdminNavModule {
    id: string;
    menu?: { path: string; label: string; icon?: string; group?: string }[];
}

/**
 * Resolves a Lucide icon name (as stored on a module menu item) to its
 * React component. Falls back to Package so unknown icons still render.
 */
export function resolveIcon(name: string | undefined): NavIconComponent {
    if (!name) return Package;
    const lib = LucideIcons as unknown as Record<string, NavIconComponent>;
    return lib[name] || Package;
}

export function useAdminNav(modules: AdminNavModule[], activeThemeId?: string): NavGroup[] {
    const t = useTranslations("admin");

    return useMemo(() => {
        // Only groups declared by a module that is actually installed here -
        // the registry lists every module's declaration, installed or not.
        const enabled = new Set(modules.map((m) => m.id));
        return buildNavGroups({
            modules,
            navGroups: ModuleNavGroups.filter((g) => enabled.has(g.module)),
            themeGroup: activeThemeId ? buildThemeNavGroup(activeThemeId) : null,
            translate: (key, fallback) => (t.has(key) ? t(key) : fallback),
            resolveIcon,
        });
    }, [modules, activeThemeId, t]);
}
