/**
 * Which downloads have a page of their own, and how to reach one.
 *
 * A file in the list is a title, a size and a button, which is everything most
 * downloads need. A launcher or a mod pack is not: there are steps, a version
 * of something else it wants first, a screenshot of the screen where the
 * setting lives. Those get a page, and the rest do not - a title that links to
 * a repeat of the line beneath it teaches a reader to stop following links.
 *
 * The URL is built from `number`, which never changes, with the slug beside it
 * for a reader. Renaming a file rewrites the slug and every link already
 * shared still lands.
 */

export interface GuidedDownload {
    number: number;
    slug: string;
    details?: string | null;
}

/** True when this download has instructions worth a page. */
export function hasGuide(download: Pick<GuidedDownload, "details">): boolean {
    return typeof download.details === "string" && download.details.trim() !== "";
}

/** Where that page lives, or null when there is not one. */
export function guideHref(download: GuidedDownload): string | null {
    if (!hasGuide(download)) return null;
    return `/downloads/${download.number}/${download.slug || "file"}`;
}

/** A slug from the title. Cosmetic, so an empty one is fine. */
export function downloadSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

/**
 * The download number out of whatever the module page router handed over.
 *
 * A module page on a catch-all receives every segment after the locale, so the
 * first is "downloads" and not the number. Read blindly it asks the API for
 * `/downloads/guide/downloads`, gets a 404, and renders the not-found state -
 * which looks exactly like a file that has no guide.
 */
export function downloadNumberFrom(raw: string | string[] | undefined): string | null {
    const segments = typeof raw === "string" ? raw.split("/") : Array.isArray(raw) ? raw : [];
    const at = segments.indexOf("downloads");
    const candidate = at >= 0 ? segments[at + 1] : segments[0];
    return candidate && /^\d+$/.test(candidate) ? candidate : null;
}

/**
 * A file size a person can read, or the label for one nobody recorded.
 *
 * Lived inside the list page until a second page needed it. Binary units,
 * because that is what a file manager shows beside the same file.
 */
export function formatFileSize(bytes: number | null | undefined, unknownLabel: string): string {
    if (!bytes) return unknownLabel;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
