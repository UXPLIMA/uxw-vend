"use client";

import { Link, usePathname } from "@/core/lib/i18n/navigation";
import { Home, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { navLabels } from "@/core/lib/admin-nav-groups";
import { useAdminNav, type AdminNavModule } from "@/core/hooks/useAdminNav";

/**
 * Small breadcrumb rendered in the admin top bar.
 *
 * A crumb names a route, and the sidebar already knows what every route is
 * called - in the reader's language, including the ones a module contributed.
 * So the label comes from the navigation first. `crumb_<slug>` covers the
 * routes that have no sidebar entry of their own (a detail page, a form), and
 * titlecasing the URL segment is the last resort, which is what the whole
 * thing used to do: on /admin/settings/payments it read "Ayarlar > Payments",
 * because an English path is not a translation.
 */
export function AdminBreadcrumb({
    modules = [],
    activeThemeId,
}: {
    modules?: AdminNavModule[];
    activeThemeId?: string;
}) {
    const pathname = usePathname();
    const t = useTranslations("admin");
    const groups = useAdminNav(modules, activeThemeId);
    const labels = navLabels(groups, (key, fallback) => (t.has(key) ? t(key) : fallback));

    // Strip /admin prefix and split
    const raw = pathname.replace(/^\/+/, "");
    const parts = raw.split("/").filter(Boolean);
    // parts[0] is "admin" - drop it
    const crumbs = parts.slice(1);

    const titleize = (slug: string, href: string) => {
        const named = labels.get(href);
        if (named) return named;
        const key = `crumb_${slug}`;
        if (t.has(key)) return t(key);
        return slug
            .replace(/-/g, " ")
            .replace(/\[.*?\]/g, "")
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .trim();
    };

    return (
        <nav
            aria-label={t("crumb_landmark")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
            <Link
                href="/admin"
                className="p-1 rounded hover:bg-muted hover:text-foreground transition"
                aria-label={t("crumb_home")}
            >
                <Home size={14} />
            </Link>
            {crumbs.map((seg, i) => {
                const isLast = i === crumbs.length - 1;
                const href = "/admin/" + crumbs.slice(0, i + 1).join("/");
                return (
                    <span key={href} className="flex items-center gap-1.5">
                        <ChevronRight size={12} className="opacity-50" />
                        {isLast ? (
                            <span className="text-foreground font-medium">{titleize(seg, href)}</span>
                        ) : (
                            <Link href={href} className="hover:text-foreground transition">
                                {titleize(seg, href)}
                            </Link>
                        )}
                    </span>
                );
            })}
            {crumbs.length === 0 && (
                <>
                    <ChevronRight size={12} className="opacity-50" />
                    <span className="text-foreground font-medium">
                        {t("crumb_overview")}
                    </span>
                </>
            )}
        </nav>
    );
}
