/**
 * Canonical slot names that core itself owns and renders.
 *
 * Two groups:
 *
 *  - GENERIC slots (3): wrap arbitrary content "anywhere" relative to the
 *    main app shell, with no fixed visual position. Used by modules that
 *    want to inject a banner, modal, head tag, etc.
 *      • layout.beforeMain — rendered immediately before <main>
 *      • layout.afterMain  — rendered immediately after </main>
 *      • head.extra        — rendered inside the <head> element
 *
 *  - LAYOUT-POSITION slots (6): named injection points wired into the
 *    core layout chrome (Navbar, Footer, MobileBottomNav). Themes and
 *    modules contribute via `slotContents` to add content into a specific
 *    visual region without modifying core React.
 *      • layout.top      — top of the page, above the navbar (e.g. announcement bar)
 *      • layout.bottom   — very bottom of the page, below the footer
 *      • navbar.start    — left side of the navbar (after logo, before menu)
 *      • navbar.end      — right side of the navbar (e.g. cart, notification bell)
 *      • footer.top      — top of the footer (e.g. CTA strip)
 *      • mobile.nav      — mobile bottom navigation bar
 *
 * Anything else is treated as a non-core slot owned by a module or theme
 * and is not validated here — modules can freely declare their own slot
 * names (`blog.article.belowContent`, etc.) for module-to-module extension.
 */
export const CANONICAL_SLOTS = [
    // Generic — position-agnostic
    "layout.beforeMain",
    "layout.afterMain",
    "head.extra",
    // Layout-position — wired into core chrome components
    "layout.top",
    "layout.bottom",
    "navbar.start",
    "navbar.end",
    "footer.top",
    "mobile.nav",
] as const;

export type CanonicalSlot = typeof CANONICAL_SLOTS[number];

const CANONICAL_SLOT_SET: Set<string> = new Set(CANONICAL_SLOTS);

/**
 * Strict membership check against the canonical slot list. Returns true
 * only when `name` is exactly one of the 9 names core renders.
 */
export function isCanonicalSlot(name: string): name is CanonicalSlot {
    return CANONICAL_SLOT_SET.has(name);
}

/**
 * Generic slot-name sanity check: shape only, no membership.
 * Used to validate user/module-defined slot names that core doesn't own.
 */
export function isValidSlotName(name: string): boolean {
    return /^[a-zA-Z0-9.-]+$/.test(name) && name.length > 0 && name.length <= 128;
}
