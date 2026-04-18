import { describe, it, expect } from "vitest";
import { detectFileType } from "@/core/lib/file-type-detection";

function bytes(...arr: number[]): Buffer {
    return Buffer.from(arr);
}

describe("detectFileType", () => {
    it("returns null for empty buffers", () => {
        expect(detectFileType(Buffer.alloc(0))).toBeNull();
    });

    it("detects PNG", () => {
        const png = Buffer.concat([
            bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
            Buffer.alloc(8),
        ]);
        expect(detectFileType(png)?.mime).toBe("image/png");
    });

    it("detects JPEG", () => {
        expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
    });

    it("detects GIF", () => {
        expect(detectFileType(Buffer.from("GIF89a\0\0"))?.mime).toBe("image/gif");
    });

    it("detects WEBP via RIFF+WEBP", () => {
        const buf = Buffer.concat([
            bytes(0x52, 0x49, 0x46, 0x46),
            bytes(0, 0, 0, 0),
            bytes(0x57, 0x45, 0x42, 0x50),
        ]);
        expect(detectFileType(buf)?.mime).toBe("image/webp");
    });

    it("detects PDF", () => {
        expect(detectFileType(Buffer.from("%PDF-1.4\n..."))?.mime).toBe("application/pdf");
    });

    it("detects ZIP", () => {
        expect(detectFileType(bytes(0x50, 0x4b, 0x03, 0x04, 0x00))?.mime).toBe("application/zip");
    });

    it("detects SVG with xml prolog", () => {
        const svg = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>');
        expect(detectFileType(svg)?.mime).toBe("image/svg+xml");
    });

    it("detects bare <svg>", () => {
        expect(detectFileType(Buffer.from('<svg xmlns="x"/>'))?.mime).toBe("image/svg+xml");
    });

    it("detects JSON", () => {
        expect(detectFileType(Buffer.from('{"a":1}'))?.mime).toBe("application/json");
    });

    it("rejects executable-looking content (MZ header)", () => {
        // Windows PE / DOS MZ binary — not in our allowlist.
        expect(detectFileType(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull();
    });

    it("rejects ELF binaries", () => {
        expect(detectFileType(bytes(0x7f, 0x45, 0x4c, 0x46))).toBeNull();
    });

    it("rejects random garbage", () => {
        expect(detectFileType(Buffer.from("abcdef random text not matching anything"))).toBeNull();
    });
});
