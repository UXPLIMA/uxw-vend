import { describe, it, expect } from "vitest";
import { readImageDimensions, MAX_IMAGE_DIMENSION } from "@/core/lib/file-type-detection";

describe("readImageDimensions", () => {
    it("returns null for too-short buffers", () => {
        expect(readImageDimensions(Buffer.alloc(4))).toBeNull();
    });

    it("returns null for non-image data", () => {
        expect(readImageDimensions(Buffer.from("hello world"))).toBeNull();
    });

    it("parses PNG IHDR width/height", () => {
        const png = Buffer.alloc(30);
        // 8-byte PNG signature
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
        // IHDR chunk length + "IHDR" + 13 byte payload (width, height...)
        png.writeUInt32BE(13, 8);
        png.write("IHDR", 12, "ascii");
        png.writeUInt32BE(640, 16);
        png.writeUInt32BE(480, 20);
        expect(readImageDimensions(png)).toEqual({ width: 640, height: 480 });
    });

    it("parses GIF dimensions", () => {
        const gif = Buffer.alloc(12);
        Buffer.from("GIF89a").copy(gif, 0);
        gif.writeUInt16LE(320, 6);
        gif.writeUInt16LE(200, 8);
        expect(readImageDimensions(gif)).toEqual({ width: 320, height: 200 });
    });

    it("parses a VP8 WEBP", () => {
        const buf = Buffer.alloc(40);
        Buffer.from("RIFF").copy(buf, 0);
        buf.writeUInt32LE(0, 4);
        Buffer.from("WEBP").copy(buf, 8);
        Buffer.from("VP8 ").copy(buf, 12);
        buf.writeUInt16LE(1024, 26);
        buf.writeUInt16LE(768, 28);
        expect(readImageDimensions(buf)).toEqual({ width: 1024, height: 768 });
    });

    it("parses a JPEG SOF0", () => {
        // SOI + SOF0 marker + small payload.
        const jpg = Buffer.from([
            0xff, 0xd8,       // SOI
            0xff, 0xc0,       // SOF0
            0x00, 0x11,       // segment length (placeholder)
            0x08,             // precision
            0x03, 0x00,       // height = 0x0300 = 768
            0x04, 0x00,       // width  = 0x0400 = 1024
            0x03,             // components
            0, 0, 0, 0, 0, 0, 0, 0,
        ]);
        expect(readImageDimensions(jpg)).toEqual({ width: 1024, height: 768 });
    });

    it("MAX_IMAGE_DIMENSION is sane", () => {
        expect(MAX_IMAGE_DIMENSION).toBeGreaterThanOrEqual(2048);
        expect(MAX_IMAGE_DIMENSION).toBeLessThanOrEqual(16384);
    });
});
