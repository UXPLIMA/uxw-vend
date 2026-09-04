/**
 * A popup carries an image and a link, both typed in by whoever holds the
 * popups permission, and both land in the DOM on every public page - the link
 * as an `href`, the image as a `src`.
 *
 * That permission is not full site admin, so the author is not necessarily
 * someone who could already run script on the site. `javascript:` in an href
 * runs with the viewer's session the moment they click; `data:` in either
 * position is the same problem wearing a different hat.
 *
 * Http(s) survives, and so does a same-origin path. The admin form's image
 * field uploads through /api/v1/upload, which hands back a site-relative
 * `/uploads/...` - refusing those meant every uploaded popup image was
 * silently dropped at render and the field looked broken. A leading `//` is
 * not one of those: it is protocol-relative and points at another host, so it
 * is treated as remote and rejected.
 */
export function safeUrl(url: string | null | undefined, allowHttp: boolean): string | null {
    if (!url) return null;
    if (url.startsWith("//")) return null;
    if (url.startsWith("/")) return url;
    if (url.startsWith("https://")) return url;
    if (allowHttp && url.startsWith("http://")) return url;
    return null;
}
