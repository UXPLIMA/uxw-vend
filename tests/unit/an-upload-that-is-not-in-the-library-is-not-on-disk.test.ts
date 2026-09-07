// @vitest-environment node
/**
 * A file the media library does not know about is not left on the disk.
 *
 * The route wrote the file, then created the MediaItem row inside its own
 * try/catch, logged a failure and returned success anyway. So a database
 * hiccup between the two left a file under public/uploads that the media
 * screen cannot show and the delete endpoint cannot reach - served forever, by
 * nothing's decision.
 *
 * Rolling the file back makes the pair atomic, and the failure retryable: the
 * operator uploads again and the second attempt works. That is only possible
 * where the file is ours to delete. `StorageProvider` declares `upload` and
 * nothing else, so a file that went to a bucket cannot be removed here at all;
 * that path keeps the old behaviour and says loudly what was orphaned.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs_ from "node:fs";
import path_ from "node:path";

let uploadResult: { url: string; path: string };
let createThrows: Error | null = null;

const create = vi.fn<(args: unknown) => Promise<{ id: string }>>(async () => {
    if (createThrows) throw createThrows;
    return { id: "m1" };
});
const uploadFile = vi.fn(async () => uploadResult);
const unlink = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
const warn = vi.fn();
const error = vi.fn();

vi.mock("@/core/lib/auth", () => ({ auth: async () => ({ user: { id: "admin1", role: "admin" } }) }));
vi.mock("@/core/lib/permissions", () => ({ isAdmin: async () => true }));
vi.mock("@/core/lib/rate-limit", () => ({
    rateLimit: async () => ({ success: true }),
    getClientIP: () => "203.0.113.1",
}));
vi.mock("@/core/lib/storage", () => ({
    uploadFile: () => uploadFile(),
    UPLOAD_MAX_SIZE: 50 * 1024 * 1024,
    UPLOAD_ALLOWED_MIME: new Set(["image/png"]),
}));
vi.mock("@/core/lib/db", () => ({ prisma: { mediaItem: { create: (a: unknown) => create(a as never) } } }));
vi.mock("@/core/lib/logger", () => ({
    log: { warn, error, info: vi.fn(), debug: vi.fn() },
    errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));
vi.mock("node:fs/promises", () => ({ default: { unlink }, unlink }));
vi.mock("fs/promises", () => ({ default: { unlink }, unlink }));

const { POST } = await import("@/app/api/v1/upload/route");
const { NextRequest } = await import("next/server");

function upload() {
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" }));
    return POST(new NextRequest("http://example.com/api/v1/upload", { method: "POST", body: form }));
}

beforeEach(() => {
    vi.clearAllMocks();
    createThrows = null;
    uploadResult = { url: "/uploads/2026/shot.png", path: "2026/shot.png" };
});

describe("an upload the media library refused to record", () => {
    it("does not report success", async () => {
        createThrows = new Error("deadlock detected");

        const response = await upload();

        expect(response.status).toBe(500);
    });

    it("takes the file back off the disk", async () => {
        createThrows = new Error("deadlock detected");

        await upload();

        expect(unlink).toHaveBeenCalledTimes(1);
        expect(String(unlink.mock.calls[0][0])).toContain("uploads");
        expect(String(unlink.mock.calls[0][0])).toContain("shot.png");
    });

    it("says what happened without handing the reader a database error", async () => {
        createThrows = new Error("deadlock detected on relation media_item_pkey");

        const body = await (await upload()).json();

        expect(body.error).not.toContain("deadlock");
        expect(body.error).toBeTruthy();
    });

    // A bucket is not ours to delete from: StorageProvider has `upload` and
    // nothing else. Reporting failure there would leave the object behind and
    // send the operator to upload a second copy of it.
    it("keeps a remote upload, and names what the library is missing", async () => {
        uploadResult = { url: "https://cdn.example.com/shot.png", path: "shot.png" };
        createThrows = new Error("deadlock detected");

        const response = await upload();

        expect(response.status).toBe(200);
        expect(unlink).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalled();
        expect(JSON.stringify(warn.mock.calls)).toContain("https://cdn.example.com/shot.png");
    });
});

describe("an upload the media library recorded", () => {
    it("returns where the file is", async () => {
        const body = await (await upload()).json();

        expect(body).toEqual({ url: "/uploads/2026/shot.png", path: "2026/shot.png" });
    });

    it("leaves the file alone", async () => {
        await upload();

        expect(create).toHaveBeenCalledTimes(1);
        expect(unlink).not.toHaveBeenCalled();
    });
});

/**
 * One route stores files today, and the pairing above is what keeps its two
 * halves together. A second one would be written by someone who has not read
 * this file, so the rule is checked rather than remembered.
 */
describe("a route that stores a file", () => {
    const ROOT = path_.resolve(import.meta.dirname, "../..");

    function routeFiles(dir: string, into: string[] = []): string[] {
        for (const entry of fs_.readdirSync(dir, { withFileTypes: true })) {
            const full = path_.join(dir, entry.name);
            if (entry.isDirectory()) routeFiles(full, into);
            else if (entry.name === "route.ts") into.push(full);
        }
        return into;
    }

    it("records it in the media library in the same handler", () => {
        const storing = routeFiles(path_.join(ROOT, "src/app/api")).filter((file) =>
            /\buploadFile\s*\(/.test(fs_.readFileSync(file, "utf8")),
        );
        expect(storing.length).toBeGreaterThan(0);

        const unrecorded = storing.filter(
            (file) => !fs_.readFileSync(file, "utf8").includes("mediaItem.create"),
        );
        expect(
            unrecorded.map((f) => path_.relative(ROOT, f)),
            "a stored file with no library entry cannot be found or deleted again",
        ).toEqual([]);
    });
});
