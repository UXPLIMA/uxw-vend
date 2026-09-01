import type { useTranslations } from "next-intl";

/**
 * Display order for module categories on the module-picking step. Anything a
 * manifest declares that is not listed here falls through to "other", so a
 * third-party module with a novel category still renders somewhere sensible
 * instead of vanishing.
 */
export const CATEGORY_ORDER = ["commerce", "community", "gaming", "management", "content", "integration"];

/** Categories `setup.modules.categories` has a label for. */
export const LABELLED_CATEGORIES = new Set([...CATEGORY_ORDER, "other"]);

export function categoryLabel(t: ReturnType<typeof useTranslations>, category: string): string {
    return LABELLED_CATEGORIES.has(category) ? t(`categories.${category}`) : category;
}
