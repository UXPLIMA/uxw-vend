export const CANONICAL_SLOTS = [
    "home.beforeHero",
    "home.afterHero",
    "home.sidebar",
    "navbar.left",
    "navbar.right",
    "footer.extra",
    "product.beforeAddToCart",
    "product.afterAddToCart",
    "profile.tabs",
] as const;

export type CanonicalSlot = typeof CANONICAL_SLOTS[number];

export function isCanonicalSlot(name: string): boolean {
    return /^[a-zA-Z0-9.-]+$/.test(name) && name.length > 0 && name.length <= 128;
}
