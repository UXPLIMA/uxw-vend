"use client";

import { DynamicIcon } from "lucide-react/dynamic";
import { toIconSlug } from "@/core/lib/icon-names";

/**
 * Lucide icon resolved by string name. Admin-supplied (navbar editor,
 * module manifests) so it must accept any valid Lucide identifier -
 * not a hardcoded whitelist. Names are case-insensitive: both
 * "ShoppingBag" and "shopping-bag" map to the same icon.
 *
 * Renders nothing if the name doesn't match a Lucide icon, so a typo
 * degrades to "no icon" instead of breaking the page.
 */
export function NavIcon({
    name,
    className,
}: {
    name?: string | null;
    className?: string;
}) {
    if (!name) return null;
    const kebab = toIconSlug(name);
    // Suspense fallback reserves the icon's layout box (className passes
    // through to it) so there's no width shift while the icon's chunk loads.
    const placeholder = () => <span className={className} aria-hidden="true" />;
    return (
        <DynamicIcon
            name={kebab as Parameters<typeof DynamicIcon>[0]["name"]}
            className={className}
            fallback={placeholder}
        />
    );
}

