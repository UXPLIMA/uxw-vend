"use client";

import { useLocale } from "next-intl";
import { formatRelativeTime } from "@/core/lib/utils";

/**
 * useRelativeTime — drop-in replacement for inline `formatRelativeTime()`
 * calls in client components. Resolves the active next-intl locale once
 * and returns a formatter, so "5 minutes ago" becomes "5 dakika önce"
 * on TR without each call site having to pull the locale itself.
 */
export function useRelativeTime() {
    const locale = useLocale();
    return (date: Date | string) => formatRelativeTime(date, locale);
}
