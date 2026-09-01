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
 * `UXWVEND_MARKETPLACE_BASE` lets a fork serve its own catalogue, and lets an
 * air-gapped install point at an internal mirror. It must be an http(s) URL —
 * these values are interpolated into `fetch()` calls that then unzip whatever
 * comes back, so a `file://` or other scheme here would be a way to read the
 * server's own disk through the module installer.
 */

const DEFAULT_BASE = "https://raw.githubusercontent.com/UXPLIMA/uxw-vend/main";

function resolveBase(): string {
    const raw = process.env.UXWVEND_MARKETPLACE_BASE?.trim().replace(/\/+$/, "");
    if (!raw) return DEFAULT_BASE;
    try {
        const url = new URL(raw);
        if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_BASE;
        return raw;
    } catch {
        return DEFAULT_BASE;
    }
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
