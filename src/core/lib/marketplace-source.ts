/**
 * Where the in-app marketplace fetches module and theme ZIPs from.
 *
 * This lived as a copy-pasted string literal in eight route handlers, all of
 * which still named the repository the project was published from before it
 * moved. The installer had been updated and they had not, so a fresh install
 * pulled its modules from one repository and its updates from another.
 *
 * Resolved at request time, never at build time: `next build` inlines
 * `NEXT_PUBLIC_*` into the bundle, which under a prebuilt image would freeze
 * whatever CI happened to have. See `app-url.ts` for the same constraint.
 *
 * `BLYSIS_MARKETPLACE_BASE` lets a fork serve its own catalogue, and lets an
 * air-gapped install point at an internal mirror. It must be an http(s) URL -
 * these values are interpolated into `fetch()` calls that then unzip whatever
 * comes back, so a `file://` or other scheme here would be a way to read the
 * server's own disk through the module installer.
 */

const DEFAULT_BASE = "https://raw.githubusercontent.com/UXPLIMA/blysis/main";

function resolveBase(): string {
    const raw = process.env.BLYSIS_MARKETPLACE_BASE?.trim().replace(/\/+$/, "");
    if (!raw) return DEFAULT_BASE;
    try {
        const url = new URL(raw);
        if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_BASE;
        return raw;
    } catch {
        return DEFAULT_BASE;
    }
}

/**
 * Whether an operator pointed this install somewhere of their own.
 *
 * A reader that has a copy of the catalogue on disk needs to know this: the
 * copy is right for an install that was never pointed anywhere, and wrong for
 * one that was, where it silently answers a question the operator asked
 * somebody else.
 */
export function marketplaceIsConfigured(): boolean {
    return resolveBase() !== DEFAULT_BASE;
}

/** The root the catalogue is served from, for readers that are not a ZIP. */
export function marketplaceBase(): string {
    return resolveBase();
}

/** Base URL for module ZIPs, e.g. `${base}/blog.zip`. */
export function moduleMarketplaceBase(): string {
    return `${resolveBase()}/module-marketplace`;
}

/** Base URL for theme ZIPs. */
export function themeMarketplaceBase(): string {
    return `${resolveBase()}/theme-marketplace`;
}

/** Catalogue of available modules. */
export function moduleMarketplaceIndexUrl(): string {
    return `${moduleMarketplaceBase()}/index.json`;
}

/** Catalogue of available themes. */
export function themeMarketplaceIndexUrl(): string {
    return `${themeMarketplaceBase()}/index.json`;
}
