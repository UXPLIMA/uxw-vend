import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format currency
 */
export function formatCurrency(
    amount: number,
    currency = "USD",
    locale = "en-US"
): string {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
    }).format(amount);
}

/**
 * Format date. Accepts an optional locale for proper localization;
 * defaults to "en-US" so existing callers keep working.
 */
export function formatDate(
    date: Date | string,
    options?: Intl.DateTimeFormatOptions,
    locale: string = "en-US",
): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        ...options,
    });
}

/**
 * Format relative time (e.g., "2 hours ago"). Locale-aware via
 * Intl.RelativeTimeFormat. Pass the active locale from `useLocale()`
 * (client) or `await getLocale()` (server) — defaults to "en" so
 * callers that don't have it handy still work.
 */
export function formatRelativeTime(date: Date | string, locale: string = "en"): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days >= 7) return formatDate(d, undefined, locale);

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (seconds < 60) return rtf.format(-seconds, "second");
    if (minutes < 60) return rtf.format(-minutes, "minute");
    if (hours < 24) return rtf.format(-hours, "hour");
    return rtf.format(-days, "day");
}

/**
 * Generate a random string
 */
export function generateId(length = 12): string {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Generate a slug from string
 */
// Diacritic transliteration map. Turkish + common European diacritics go first
// since they don't all decompose with NFD (ı, ğ, ş don't).
const DIACRITIC_MAP: Record<string, string> = {
    "ı": "i", "İ": "i", "ğ": "g", "Ğ": "g", "ş": "s", "Ş": "s",
    "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c",
    "ß": "ss", "æ": "ae", "Æ": "ae", "œ": "oe", "Œ": "oe",
    "ñ": "n", "Ñ": "n", "ł": "l", "Ł": "l",
};

export function slugify(text: string): string {
    return text
        .toString()
        // Transliterate explicit map first (handles Turkish ı/ğ/ş/etc.)
        .replace(/[ıİğĞşŞüÜöÖçÇßæÆœŒñÑłŁ]/g, (c) => DIACRITIC_MAP[c] || c)
        // Strip remaining diacritics via NFD decomposition (é → e, ñ → n, etc.)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/\-\-+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");
}

// Alias for slugify
export const generateSlug = slugify;

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
    if (text.length <= length) return text;
    return text.slice(0, length) + "...";
}

/**
 * Delay/sleep function
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
    try {
        return JSON.parse(json) as T;
    } catch {
        return fallback;
    }
}

/**
 * Generate order number
 */
export function generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
}
