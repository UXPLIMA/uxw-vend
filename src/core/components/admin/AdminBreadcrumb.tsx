"use client";

import { Link, usePathname } from "@/core/lib/i18n/navigation";
import { Home, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Small breadcrumb rendered in the admin top bar.
 * Derives labels from the current pathname. Segments are lowercased
 * path pieces turned into Title Case; the first crumb is always a
 * Home icon linking to /admin.
 */
export function AdminBreadcrumb() {
    const pathname = usePathname();
    const t = useTranslations("admin");

    // Strip /admin prefix and split
    const raw = pathname.replace(/^\/+/, "");
    const parts = raw.split("/").filter(Boolean);
    // parts[0] is "admin" — drop it
    const crumbs = parts.slice(1);

    const titleize = (slug: string) => {
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
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
            <Link
                href="/admin"
                className="p-1 rounded hover:bg-muted hover:text-foreground transition"
                aria-label="Admin home"
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
                            <span className="text-foreground font-medium">{titleize(seg)}</span>
                        ) : (
                            <Link href={href} className="hover:text-foreground transition">
                                {titleize(seg)}
                            </Link>
                        )}
                    </span>
                );
            })}
            {crumbs.length === 0 && (
                <>
                    <ChevronRight size={12} className="opacity-50" />
                    <span className="text-foreground font-medium">
                        {t.has("crumb_overview") ? t("crumb_overview") : "Overview"}
                    </span>
                </>
            )}
        </nav>
    );
}
