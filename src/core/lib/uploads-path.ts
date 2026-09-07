import path from "path";

/**
 * The file on disk a media record's `url` names, or nothing.
 *
 * Deleting a media record unlinks the file it names, and the url comes out of
 * the database. The check used to be that it starts with `/uploads/`, which is
 * not containment: `/uploads/../../x` starts with `/uploads/` too, and
 * `path.join` resolves it away before `unlink` sees it.
 *
 * Nothing writes such a url today - the upload route builds it from a
 * sanitised filename and the media PATCH accepts `alt` and `filename` only -
 * so this is the standard `resolveBackupPath` already sets, applied to the
 * other place a stored string becomes a path. That one calls its own prefix
 * test "defence-in-depth against traversal" and pairs it with a containment
 * check, because a prefix on its own does not do it.
 *
 * Returns `null` rather than throwing: a url this function will not vouch for
 * is one the caller leaves alone, and the record is still the caller's to
 * delete.
 */

const UPLOADS_DIR = path.resolve(process.cwd(), "public", "uploads");

export function resolveUploadPath(url: string): string | null {
    if (!url.startsWith("/uploads/")) return null;

    const full = path.resolve(process.cwd(), "public", `.${url}`);
    if (!full.startsWith(UPLOADS_DIR + path.sep)) return null;

    return full;
}
