import DOMPurify from "isomorphic-dompurify";

/**
 * HTML content sanitization for user-generated rich text.
 *
 * All user-submitted HTML (blog articles, forum posts, suggestions, help
 * articles, custom pages, changelog entries, announcements) MUST be passed
 * through one of these helpers at WRITE time (in the create/update API
 * handler), BEFORE the value is persisted to the database. Sanitizing on
 * write — rather than on read — prevents stored XSS payloads from ever
 * reaching the database in the first place.
 *
 * Never render untrusted HTML via `dangerouslySetInnerHTML` without first
 * passing it through `sanitizeHtml` (or `sanitizeInline` for one-line fields).
 */

// Allowed HTML tags for rich content. Keep conservative — users cannot inject
// scripts, iframes, forms, or any JS-executing element.
const ALLOWED_TAGS = [
    "p", "br", "strong", "em", "u", "s", "b", "i",
    "a", "img", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "pre", "code",
    "hr", "table", "thead", "tbody", "tr", "th", "td",
    "span", "div",
];

const ALLOWED_ATTR = ["href", "src", "alt", "title", "class", "target", "rel"];

/**
 * Full rich-text sanitizer. Use for article/post/comment body fields.
 */
export function sanitizeHtml(dirty: string): string {
    if (typeof dirty !== "string") return "";
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
        FORBID_TAGS: ["script", "style", "iframe", "form", "input", "button", "embed", "object"],
        FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "style"],
    });
}

/**
 * Stricter variant — for places that should only accept plain text plus minimal
 * inline formatting (titles, short blurbs, inline description fields).
 */
export function sanitizeInline(dirty: string): string {
    if (typeof dirty !== "string") return "";
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ["strong", "em", "a", "br"],
        ALLOWED_ATTR: ["href", "title", "target", "rel"],
        ALLOW_DATA_ATTR: false,
    });
}
