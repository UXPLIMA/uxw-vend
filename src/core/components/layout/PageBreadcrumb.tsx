"use client";

import React from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { useTranslations } from "next-intl";

export interface Crumb {
    label: string;
    href: string;
}

interface PageBreadcrumbProps {
    /** The steps between the home page and the current one. */
    trail?: Crumb[];
    /** Where the reader is now. Named, not linked. */
    current: string;
}

/**
 * The trail from the home page to here.
 *
 * A client component because the first step is always "Home" and that word is
 * translated, which a shared frame cannot ask for on the server without
 * becoming async and shutting out every page that says "use client".
 */
export function PageBreadcrumb({ trail = [], current }: PageBreadcrumbProps) {
    const t = useTranslations("common");

    return (
        <nav aria-label={t("breadcrumb")} className="text-sm text-muted-foreground">
            <ol className="flex flex-wrap items-center">
                <li>
                    <Link href="/" className="hover:text-primary transition-colors">{t("home")}</Link>
                </li>
                {trail.map((crumb) => (
                    <li key={`${crumb.href}${crumb.label}`}>
                        <span className="mx-2" aria-hidden="true">/</span>
                        <Link href={crumb.href} className="hover:text-primary transition-colors">{crumb.label}</Link>
                    </li>
                ))}
                <li>
                    <span className="mx-2" aria-hidden="true">/</span>
                    <span className="text-foreground" aria-current="page">{current}</span>
                </li>
            </ol>
        </nav>
    );
}
