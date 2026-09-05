/**
 * Copy a string to the clipboard, on every origin the platform runs on.
 *
 * `navigator.clipboard` is a secure-context API. A self-hosted site reached
 * over plain http:// by IP address - which is what a fresh install is, before
 * anyone has pointed a domain at it and issued a certificate - does not get
 * one: `navigator.clipboard` is `undefined`, and every "Copy" button on the
 * panel threw `TypeError: navigator.clipboard is undefined` into the console
 * and did nothing visible.
 *
 * So: use the real API where it exists, and fall back to the old
 * `document.execCommand("copy")` over an offscreen textarea where it does not.
 * execCommand is deprecated and every browser still implements it, which is
 * the whole reason it is the fallback and not the primary.
 *
 * Returns whether the text actually made it, so a caller can show "Copied" on
 * success and say something honest on failure instead of lying with a
 * checkmark.
 */
export async function copyText(value: string): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch {
            // Permission refused, or a non-focused document. The textarea
            // route below is still worth trying.
        }
    }
    return copyViaTextarea(value);
}

function copyViaTextarea(value: string): boolean {
    if (typeof document === "undefined") return false;
    const area = document.createElement("textarea");
    area.value = value;
    // Offscreen rather than hidden: `display: none` and `visibility: hidden`
    // are not selectable, and an unselectable textarea copies nothing.
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    try {
        area.select();
        area.setSelectionRange(0, value.length);
        return document.execCommand("copy");
    } catch {
        return false;
    } finally {
        document.body.removeChild(area);
    }
}
