"use client";

import { useState, useMemo, useEffect } from "react";
import { Link, usePathname, useRouter } from "@/core/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { useDarkMode } from "@/core/hooks/useDarkMode";
import type { ComponentType } from "react";
import * as LucideIcons from "lucide-react";
import { Menu, X, Sun, Moon, Package } from "lucide-react";
import {
    CORE_NAV_GROUPS,
    findActiveGroupId,
    inferModuleGroup,
    type NavGroup,
    type NavItem,
    type NavSection,
} from "@/core/lib/admin-nav-groups";

type IconComponent = ComponentType<{ size?: number; className?: string }>;

/**
 * Resolves a Lucide icon name (as stored on a module menu item) to its
 * React component. Falls back to Package so unknown icons still render.
 */
function resolveIcon(name: string | undefined): IconComponent {
    if (!name) return Package;
    const lib = LucideIcons as unknown as Record<string, IconComponent>;
    return lib[name] || Package;
}

interface SidebarModule {
    id: string;
    menu?: { path: string; label: string; icon?: string; group?: string }[];
}

interface AdminSidebarProps {
    userName?: string;
    userEmail?: string;
    modules?: SidebarModule[];
    themeGroup?: NavGroup | null;
}

/**
 * Two-level admin sidebar.
 *
 *   [ icon rail ] [ contextual sidebar ]
 *       w-14            w-56
 *
 * Icon rail: one icon per top-level group (Dashboard, Users, Content,
 * Commerce, Design, Marketplace, Activity, Advanced, Settings). Clicking
 * an icon selects that group.
 *
 * Contextual sidebar: shows the items in the currently-selected group,
 * broken into sections with small uppercase headers. Module `menu[]`
 * contributions are merged in under the matching group at render time.
 *
 * Mobile: both rails collapse into a single overlay sheet.
 */
export function AdminSidebar({ modules = [], themeGroup }: AdminSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [mobileOpen, setMobileOpen] = useState(false);
    const { isDark, toggle: toggleDarkMode } = useDarkMode();
    const t = useTranslations("admin");

    // Merge module menus into matching groups.
    // - Multi-item modules get one labelled section per module
    // - Single-item modules append to a shared "Extensions" tail section
    //   (no per-module header — avoids a wall of one-item headers)
    const groups: NavGroup[] = useMemo(() => {
        // Build base group list: core → theme → (modules extend existing groups)
        const baseGroups = themeGroup
            ? [...CORE_NAV_GROUPS, themeGroup]
            : [...CORE_NAV_GROUPS];

        const byId = new Map(
            baseGroups.map((g) => [
                g.id,
                { ...g, sections: g.sections.map((s) => ({ ...s, items: [...s.items] })) },
            ]),
        );

        // Per-group, track a section per module id so we don't create
        // duplicate headers for the same module.
        const sectionByGroupAndModule = new Map<string, NavSection>();
        const extensionSectionByGroup = new Map<string, NavSection>();

        for (const mod of modules) {
            if (!mod.menu || mod.menu.length === 0) continue;

            const modLabelKey = `menu_${mod.id}`;
            const modLabel = t.has(modLabelKey)
                ? t(modLabelKey)
                : mod.id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

            const isMulti = mod.menu.length > 1;

            for (const item of mod.menu) {
                const groupId = item.group || inferModuleGroup(mod.id);
                const target = byId.get(groupId);
                if (!target) continue;

                const itemLabelKey = `menu_${mod.id}_${item.label.replace(/\s+/g, "_").toLowerCase()}`;
                const label = t.has(itemLabelKey) ? t(itemLabelKey) : item.label;
                const href = `/admin${item.path.startsWith("/") ? item.path : "/" + item.path}`;

                const itemIcon = resolveIcon(item.icon);

                if (isMulti) {
                    // Named section for multi-item modules, keyed by moduleId
                    const key = `${groupId}::${mod.id}`;
                    let section = sectionByGroupAndModule.get(key);
                    if (!section) {
                        section = { header: modLabel, items: [] };
                        sectionByGroupAndModule.set(key, section);
                        target.sections.push(section);
                    }
                    section.items.push({ href, label, icon: itemIcon });
                } else {
                    // Single-item module: append to shared extensions tail
                    let section = extensionSectionByGroup.get(groupId);
                    if (!section) {
                        const headerKey = "sidebar_extensions";
                        section = {
                            header: t.has(headerKey) ? t(headerKey) : "Extensions",
                            items: [],
                        };
                        extensionSectionByGroup.set(groupId, section);
                        target.sections.push(section);
                    }
                    section.items.push({ href, label, icon: itemIcon });
                }
            }
        }

        return Array.from(byId.values());
    }, [modules, themeGroup, t]);

    // Selection state machine:
    //   - `pathDerivedId` is the group the current URL resolves to
    //   - `userSelection` is an explicit icon click that may diverge
    //     from the URL (e.g. clicking Commerce while still on Dashboard
    //     to browse an empty group before picking a module item)
    //   - On pathname change we clear `userSelection` so the URL-derived
    //     group takes over naturally after any Link navigation
    const pathDerivedId = findActiveGroupId(pathname, groups) || "dashboard";
    const [userSelection, setUserSelection] = useState<string | null>(null);

    useEffect(() => {
        setUserSelection(null);
    }, [pathname]);

    const effectiveGroupId = userSelection || pathDerivedId;
    const activeGroup = groups.find((g) => g.id === effectiveGroupId) || groups[0];

    const handleGroupClick = (group: NavGroup) => {
        setUserSelection(group.id);
        setMobileOpen(false);
        // If the group has items and the current pathname isn't already
        // in that group, navigate to the first item so the main content
        // updates immediately. Commerce-style empty groups just reveal
        // the contextual sidebar with a "no items" message.
        const firstItem = group.sections.find((s) => s.items.length > 0)?.items[0];
        if (firstItem && pathDerivedId !== group.id) {
            router.push(firstItem.href);
        }
    };

    const isActive = (href: string) => {
        if (href === "/admin") return pathname === "/admin" || pathname === "/admin/";
        // Collect all item hrefs in the current group so we can use
        // longest-prefix matching. This prevents "/admin/settings" from
        // lighting up when "/admin/settings/general" is the real match.
        const allHrefs = activeGroup.sections.flatMap((s) => s.items.map((i) => i.href));
        const matchesHref = pathname === href || pathname.startsWith(href + "/");
        if (!matchesHref) return false;
        // If another item in the same group is a longer (more specific) match, this one loses.
        for (const other of allHrefs) {
            if (other === href) continue;
            if (other.length > href.length && (pathname === other || pathname.startsWith(other + "/"))) {
                return false;
            }
        }
        return true;
    };

    const labelOf = (item: NavItem): string => {
        if (item.labelKey && t.has(item.labelKey)) return t(item.labelKey);
        return item.label;
    };

    const sectionHeaderOf = (section: NavSection): string | undefined => {
        if (section.headerKey && t.has(section.headerKey)) return t(section.headerKey);
        return section.header;
    };

    const groupLabelOf = (group: NavGroup): string => {
        if (group.labelKey && t.has(group.labelKey)) return t(group.labelKey);
        return group.label;
    };

    // ─── Icon rail ───
    const iconRail = (
        <div className="flex flex-col h-full py-3 items-center gap-1">
            <div className="relative group/rail mb-2">
                <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition"
                    aria-label="uxwVend admin"
                >
                    <span className="text-xs font-bold">UV</span>
                </Link>
                <span
                    role="tooltip"
                    className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded-md bg-foreground text-background text-xs font-medium whitespace-nowrap shadow-lg opacity-0 group-hover/rail:opacity-100 transition-opacity duration-150 z-50"
                >
                    uxwVend
                </span>
            </div>
            {groups.map((group) => {
                const Icon = group.icon;
                const isSelected = effectiveGroupId === group.id;
                const hasItems = group.sections.some((s) => s.items.length > 0);
                const label = groupLabelOf(group);
                return (
                    <div key={group.id} className="relative group/rail">
                        <button
                            type="button"
                            onClick={() => handleGroupClick(group)}
                            aria-label={label}
                            aria-current={isSelected ? "page" : undefined}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition relative ${
                                isSelected
                                    ? "bg-primary/15 text-primary"
                                    : hasItems
                                        ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                                        : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            <Icon size={18} />
                            {isSelected && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
                            )}
                        </button>
                        {/* CSS tooltip — appears to the right on hover */}
                        <span
                            role="tooltip"
                            className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded-md bg-foreground text-background text-xs font-medium whitespace-nowrap shadow-lg opacity-0 group-hover/rail:opacity-100 transition-opacity duration-150 z-50"
                        >
                            {label}
                        </span>
                    </div>
                );
            })}

            <div className="mt-auto flex flex-col items-center gap-1">
                <div className="relative group/rail">
                    <button
                        type="button"
                        onClick={toggleDarkMode}
                        aria-label={isDark ? t("sidebar_lightMode") : t("sidebar_darkMode")}
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    >
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <span
                        role="tooltip"
                        className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded-md bg-foreground text-background text-xs font-medium whitespace-nowrap shadow-lg opacity-0 group-hover/rail:opacity-100 transition-opacity duration-150 z-50"
                    >
                        {isDark ? t("sidebar_lightMode") : t("sidebar_darkMode")}
                    </span>
                </div>
            </div>
        </div>
    );

    // ─── Contextual sidebar ───
    const contextSidebar = (
        <div className="flex flex-col h-full py-4 px-3 overflow-y-auto">
            <div className="px-2 mb-4">
                <h2 className="text-sm font-semibold text-foreground">{groupLabelOf(activeGroup)}</h2>
            </div>

            <nav className="flex-1 space-y-4" aria-label={groupLabelOf(activeGroup)}>
                {activeGroup.sections.map((section, sIdx) => (
                    <div key={`${activeGroup.id}-${sIdx}`}>
                        {section.header && (
                            <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                {sectionHeaderOf(section)}
                            </div>
                        )}
                        <ul className="space-y-0.5">
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);
                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            onClick={() => setMobileOpen(false)}
                                            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition ${
                                                active
                                                    ? "bg-primary/10 text-primary font-medium"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                            }`}
                                        >
                                            {Icon && <Icon size={15} className={active ? "text-primary" : ""} />}
                                            <span className="truncate flex-1">{labelOf(item)}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
                {activeGroup.sections.every((s) => s.items.length === 0) && (
                    <div className="px-2 py-4 text-xs text-muted-foreground">
                        {t.has("sidebar_emptyGroup") ? t("sidebar_emptyGroup") : "No items in this group yet."}
                    </div>
                )}
            </nav>
        </div>
    );

    return (
        <>
            {/* Mobile hamburger */}
            <button
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-card border shadow-sm flex items-center justify-center"
            >
                <Menu size={20} />
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Mobile sidebar: stacks icon rail above contextual items */}
            <aside
                aria-label="Admin navigation"
                className={`lg:hidden fixed top-0 left-0 bottom-0 flex z-50 transition-transform duration-200 bg-card border-r border-border ${
                    mobileOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <div className="w-14 border-r border-border bg-background/50">{iconRail}</div>
                <div className="w-56 relative">
                    <button
                        onClick={() => setMobileOpen(false)}
                        aria-label="Close menu"
                        className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center z-10"
                    >
                        <X size={18} />
                    </button>
                    {contextSidebar}
                </div>
            </aside>

            {/* Desktop: fixed icon rail + contextual sidebar */}
            <aside
                aria-label="Admin navigation"
                className="hidden lg:flex fixed top-0 left-0 bottom-0 bg-card border-r border-border z-30"
            >
                <div className="w-14 border-r border-border bg-background/30">{iconRail}</div>
                <div className="w-56">{contextSidebar}</div>
            </aside>
        </>
    );
}
