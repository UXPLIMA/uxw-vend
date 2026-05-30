/**
 * SVG is allowed in uploads but the format is a Trojan horse for XSS:
 * `<script>`, event handlers like `onload=`, `javascript:` in `href`, and
 * `<foreignObject>` can all execute when the browser renders the SVG
 * inline (e.g. `<img src="x.svg">` avoids script execution but direct
 * inclusion via `<object>` or an `<embed>` does not, and users embed
 * SVGs in rich text).
 *
 * This is a regex-based scrubber — not as thorough as DOMPurify with the
 * XML profile, but zero-dependency and covers the common vectors. It
 * runs on BOTH admin uploads and theme/ZIP extraction.
 */

const DANGEROUS_TAGS = /<\/?(script|foreignObject|iframe|embed|object|link|meta|style)\b[^>]*>/gi;
const EVENT_HANDLERS = /\s(on[a-z]+)\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const JS_HREF = /\s(href|xlink:href)\s*=\s*(['"])\s*javascript:[^'"\s>]*\2/gi;
const DATA_HANDLER = /\s(href|xlink:href|src)\s*=\s*(['"])\s*data:text\/html[^'"\s>]*\2/gi;

/**
 * Apply a strip regex repeatedly until the string stops changing. A single
 * pass is defeatable by overlapping/nested injections (e.g.
 * `<scr<script>ipt>` collapses to `<script>` after one replace), so we
 * re-run until stable, capped to avoid pathological inputs.
 */
function stripUntilStable(str: string, regex: RegExp): string {
    let cur = str;
    for (let i = 0; i < 20; i++) {
        const next = cur.replace(regex, "");
        if (next === cur) break;
        cur = next;
    }
    return cur;
}

export function sanitizeSvg(input: string): string {
    if (!input) return "";

    let out = input;

    // Drop tags that can execute or fetch third-party content.
    out = stripUntilStable(out, DANGEROUS_TAGS);

    // Strip every on* attribute regardless of tag.
    out = stripUntilStable(out, EVENT_HANDLERS);

    // Block javascript: and data:text/html URIs in href / xlink:href / src.
    out = stripUntilStable(out, JS_HREF);
    out = stripUntilStable(out, DATA_HANDLER);

    return out;
}

export function sanitizeSvgBuffer(buffer: Buffer): Buffer {
    const text = buffer.toString("utf8");
    return Buffer.from(sanitizeSvg(text), "utf8");
}
