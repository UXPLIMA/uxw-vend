/**
 * Admin-authored footer links.
 *
 * `footer_quick_links` and `footer_legal_links` are free-form JSON settings
 * edited in Admin > Settings > Footer. They are the reason core no longer
 * hardcodes a legal column: which pages an install considers "legal" is a
 * per-site decision, not something core can know.
 *
 * The value is admin-supplied and rendered as an anchor, so every href is
 * checked here rather than at the render site.
 */

export interface FooterLink {
    label: string;
    href: string;
    /** True for absolute http(s) links, which render as a plain anchor. */
    external: boolean;
}

const MAX_LINKS = 20;
const MAX_LABEL = 64;

/**
 * Internal paths only, or absolute http(s). Everything else — `javascript:`,
 * `data:`, `mailto:`, and protocol-relative `//host` — is dropped.
 */
function classifyHref(href: string): { href: string; external: boolean } | null {
    if (href.startsWith("//")) return null;
    if (href.startsWith("/")) return { href, external: false };

    let url: URL;
    try {
        url = new URL(href);
    } catch {
        return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return { href, external: true };
}

export function parseFooterLinks(raw: unknown): FooterLink[] {
    let value = raw;

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            value = JSON.parse(trimmed);
        } catch {
            return [];
        }
    }

    if (!Array.isArray(value)) return [];

    const links: FooterLink[] = [];
    for (const entry of value) {
        if (links.length >= MAX_LINKS) break;
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;

        const { label, href } = entry as { label?: unknown; href?: unknown };
        if (typeof label !== "string" || typeof href !== "string") continue;

        const cleanLabel = label.trim();
        const classified = classifyHref(href.trim());
        if (!cleanLabel || !classified) continue;

        links.push({
            label: cleanLabel.slice(0, MAX_LABEL),
            href: classified.href,
            external: classified.external,
        });
    }

    return links;
}
