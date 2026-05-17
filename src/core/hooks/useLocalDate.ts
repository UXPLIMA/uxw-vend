"use client";

import { useLocale } from "next-intl";

/**
 * useLocalDate — returns a date formatter bound to the active next-intl
 * locale. Replaces inline `new Date(x).toLocaleDateString()` calls that
 * default to en-US regardless of the user's chosen language.
 *
 * Example:
 *   const fmt = useLocalDate();
 *   <span>{fmt(item.createdAt)}</span>
 */
export function useLocalDate(options?: Intl.DateTimeFormatOptions) {
    const locale = useLocale();
    const tag = locale === "tr" ? "tr-TR" : locale;
    return (date: Date | string | number) => {
        const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
        return d.toLocaleDateString(tag, options);
    };
}
