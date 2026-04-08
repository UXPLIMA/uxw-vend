import { describe, it, expect } from "vitest";
import { sanitizeFilename } from "@/core/lib/storage";

describe("storage: sanitizeFilename", () => {
    it("preserves a normal filename", () => {
        expect(sanitizeFilename("photo.jpg")).toBe("photo.jpg");
    });

    it("strips path traversal sequences", () => {
        expect(sanitizeFilename("../../etc/passwd")).toBe("etc-passwd");
    });

    it("strips backslashes", () => {
        expect(sanitizeFilename("foo\\bar.txt")).toBe("foo-bar.txt");
    });

    it("replaces unsafe characters with hyphens", () => {
        expect(sanitizeFilename("hello world!.png")).toBe("hello-world-.png");
    });

    it("collapses repeated hyphens", () => {
        expect(sanitizeFilename("foo   bar.txt")).toBe("foo-bar.txt");
    });

    it("handles only invalid characters", () => {
        expect(sanitizeFilename("...")).toBe("file");
    });

    it("caps long filenames at 120 chars while preserving extension", () => {
        const long = "a".repeat(200) + ".png";
        const result = sanitizeFilename(long);
        expect(result.length).toBeLessThanOrEqual(120);
        expect(result.endsWith(".png")).toBe(true);
    });

    it("strips control characters", () => {
        expect(sanitizeFilename("foo\x00\x1fbar.txt")).toBe("foo-bar.txt");
    });
});
