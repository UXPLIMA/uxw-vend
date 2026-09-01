/**
 * Trigger a browser download for a same-origin URL.
 *
 * The admin screens used to do this with `window.location.href = url`, which
 * works only because the endpoint sets `Content-Disposition: attachment`. When
 * it doesn't — an expired session redirecting to the login page, a 500 that
 * renders an error body — the browser navigates away and the admin loses the
 * page they were on, along with any filter state.
 *
 * A synthetic anchor click asks for the same download without ever committing
 * a navigation, so a failed response leaves the current page untouched.
 */
export function downloadFromUrl(url: string, filename?: string): void {
    if (typeof document === "undefined") return;

    const anchor = document.createElement("a");
    anchor.href = url;
    // Same-origin only: `download` is ignored cross-origin, and these URLs are
    // always this app's own API routes.
    anchor.download = filename ?? "";
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}
