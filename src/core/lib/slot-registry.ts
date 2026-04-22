export const CANONICAL_SLOTS = [
    "layout.beforeMain",
    "layout.afterMain",
    "head.extra",
] as const;

export type CanonicalSlot = typeof CANONICAL_SLOTS[number];

export function isCanonicalSlot(name: string): boolean {
    return /^[a-zA-Z0-9.-]+$/.test(name) && name.length > 0 && name.length <= 128;
}
