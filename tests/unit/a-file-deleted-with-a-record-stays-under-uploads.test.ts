// @vitest-environment node
import { describe, it, expect } from "vitest";
import path from "node:path";
import { resolveUploadPath } from "@/core/lib/uploads-path";

/**
 * Deleting a media record unlinks the file it names.
 *
 * The record's `url` came out of the database and went into
 * `path.join(process.cwd(), "public", item.url)` behind one check, that it
 * starts with `/uploads/`. A prefix is not containment: `/uploads/../../x`
 * starts with `/uploads/` too, and `path.join` resolves it away.
 *
 * Nothing writes such a url today. `POST /api/v1/upload` builds it from a
 * sanitised filename and `PATCH /api/v1/media/[id]` accepts `alt` and
 * `filename` and nothing else, so this is hardening rather than a hole. It is
 * also the standard the product already sets: `resolveBackupPath` calls its
 * own prefix test "defence-in-depth against traversal" and pairs it with a
 * containment check, because the author knew the prefix alone does not do it.
 *
 * A path that does not resolve inside the uploads directory is not refused
 * loudly, it simply is not a file this route may unlink: the caller skips it
 * and the record still goes.
 */

const UPLOADS = path.resolve(process.cwd(), "public", "uploads");

describe("the file a media record names", () => {
    it("resolves inside the uploads directory", () => {
        const resolved = resolveUploadPath("/uploads/photo.png");
        expect(resolved).toBe(path.join(UPLOADS, "photo.png"));
    });

    it("may sit in a subdirectory the upload path made", () => {
        expect(resolveUploadPath("/uploads/2026/09/photo.png")).toBe(
            path.join(UPLOADS, "2026", "09", "photo.png"),
        );
    });

    it("is nothing when the url climbs out", () => {
        expect(resolveUploadPath("/uploads/../../etc/passwd")).toBeNull();
        expect(resolveUploadPath("/uploads/../.env")).toBeNull();
    });

    it("is nothing when the url is not an upload at all", () => {
        expect(resolveUploadPath("/logo.png")).toBeNull();
        expect(resolveUploadPath("https://cdn.example.com/x.png")).toBeNull();
        expect(resolveUploadPath("")).toBeNull();
    });

    it("is nothing for the uploads directory itself", () => {
        expect(resolveUploadPath("/uploads/")).toBeNull();
        expect(resolveUploadPath("/uploads")).toBeNull();
    });
});
