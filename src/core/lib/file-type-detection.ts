/**
 * Minimal content-sniffing for uploaded files. Trusting the client's MIME
 * header is how you end up shipping `.exe` renamed to `image/png` — every
 * uploader (themes, module ZIPs, the admin media library) normalizes on
 * this helper.
 *
 * We match against the canonical magic-byte prefixes of the file formats
 * we actually accept. Unknown bytes always fail — additions go here, not
 * in the caller.
 */

export interface DetectedType {
    /** Canonical MIME type derived from the bytes themselves. */
    mime: string;
    /** Typical extension for display purposes only — never trusted. */
    ext: string;
}

export interface ImageDimensions {
    width: number;
    height: number;
}

/**
 * Hard cap for image dimensions. A 20000x20000 PNG only weighs a few MB
 * on disk but decompresses to ~1.5 GB of RGBA pixels, enough to knock the
 * server over on the first `sharp.resize()` call. 8192 gives plenty of
 * headroom for real-world photos / banners.
 */
export const MAX_IMAGE_DIMENSION = 8192;

function startsWith(buffer: Buffer, prefix: number[], offset = 0): boolean {
    if (buffer.length < offset + prefix.length) return false;
    for (let i = 0; i < prefix.length; i++) {
        if (buffer[offset + i] !== prefix[i]) return false;
    }
    return true;
}

/**
 * Extract image dimensions from a buffer by reading the format's header
 * only (no decompression). Returns null when we can't tell or when the
 * format isn't one we allow. Used to reject decompression bombs BEFORE
 * the buffer reaches Sharp / the storage provider.
 */
export function readImageDimensions(buffer: Buffer): ImageDimensions | null {
    if (buffer.length < 10) return null;

    // PNG: 8-byte signature, then IHDR chunk at offset 16–24 carries
    // width (uint32 BE) and height (uint32 BE).
    if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        if (buffer.length < 24) return null;
        return {
            width: buffer.readUInt32BE(16),
            height: buffer.readUInt32BE(20),
        };
    }

    // GIF: "GIF87a" / "GIF89a" + logical-screen-descriptor at offset 6–10
    // (width, height are uint16 LE).
    if (
        startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    ) {
        if (buffer.length < 10) return null;
        return {
            width: buffer.readUInt16LE(6),
            height: buffer.readUInt16LE(8),
        };
    }

    // WEBP: RIFF container, VP8/VP8L/VP8X chunk carries dimensions.
    if (
        startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
    ) {
        const fourCC = buffer.slice(12, 16).toString("ascii");
        if (fourCC === "VP8 " && buffer.length >= 30) {
            // uint14 width/height at bytes 26/28.
            return {
                width: buffer.readUInt16LE(26) & 0x3fff,
                height: buffer.readUInt16LE(28) & 0x3fff,
            };
        }
        if (fourCC === "VP8L" && buffer.length >= 25) {
            // 14-bit width+1, 14-bit height+1 across bytes 21–24.
            const b0 = buffer.readUInt32LE(21);
            return {
                width: (b0 & 0x3fff) + 1,
                height: ((b0 >> 14) & 0x3fff) + 1,
            };
        }
        if (fourCC === "VP8X" && buffer.length >= 30) {
            // uint24 width-1 LE at 24, height-1 LE at 27.
            const w =
                buffer[24] | (buffer[25] << 8) | (buffer[26] << 16);
            const h =
                buffer[27] | (buffer[28] << 8) | (buffer[29] << 16);
            return { width: w + 1, height: h + 1 };
        }
        return null;
    }

    // JPEG: walk SOF (Start of Frame) markers.
    if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
        let offset = 2;
        while (offset + 9 < buffer.length) {
            if (buffer[offset] !== 0xff) return null;
            const marker = buffer[offset + 1];
            offset += 2;
            // Standalone markers (no length).
            if (marker === 0xd9 || marker === 0xd8) return null;
            // SOFn markers carry dimensions.
            if (
                (marker >= 0xc0 && marker <= 0xc3) ||
                (marker >= 0xc5 && marker <= 0xc7) ||
                (marker >= 0xc9 && marker <= 0xcb) ||
                (marker >= 0xcd && marker <= 0xcf)
            ) {
                if (offset + 7 >= buffer.length) return null;
                return {
                    height: buffer.readUInt16BE(offset + 3),
                    width: buffer.readUInt16BE(offset + 5),
                };
            }
            const segLen = buffer.readUInt16BE(offset);
            offset += segLen;
        }
        return null;
    }

    // SVG / other text-ish types: no raster dimensions to enforce here.
    return null;
}

function looksLikeText(buffer: Buffer, needle: string): boolean {
    const sample = buffer.slice(0, 512).toString("utf8");
    return sample.trimStart().toLowerCase().startsWith(needle);
}

/**
 * Return the detected type, or null when the bytes don't match anything we
 * allow. Callers that get null MUST reject the upload — do not fall back to
 * the client-supplied MIME.
 */
export function detectFileType(buffer: Buffer): DetectedType | null {
    if (buffer.length === 0) return null;

    // PNG
    if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return { mime: "image/png", ext: "png" };
    }

    // JPEG
    if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
        return { mime: "image/jpeg", ext: "jpg" };
    }

    // GIF87a / GIF89a
    if (
        startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    ) {
        return { mime: "image/gif", ext: "gif" };
    }

    // WEBP: "RIFF...WEBP"
    if (
        startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
    ) {
        return { mime: "image/webp", ext: "webp" };
    }

    // PDF
    if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) {
        return { mime: "application/pdf", ext: "pdf" };
    }

    // ZIP (also covers .zip and some office formats we don't care about here)
    if (
        startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
        startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
        startsWith(buffer, [0x50, 0x4b, 0x07, 0x08])
    ) {
        return { mime: "application/zip", ext: "zip" };
    }

    // SVG — text-based. Accept both <?xml prefix and bare <svg.
    if (looksLikeText(buffer, "<?xml") || looksLikeText(buffer, "<svg")) {
        const sample = buffer.slice(0, 4096).toString("utf8").toLowerCase();
        if (sample.includes("<svg")) {
            return { mime: "image/svg+xml", ext: "svg" };
        }
    }

    // JSON — best-effort: valid JSON must start with { or [ (after whitespace).
    const firstNonSpace = buffer.slice(0, 64).toString("utf8").trimStart()[0];
    if (firstNonSpace === "{" || firstNonSpace === "[") {
        try {
            JSON.parse(buffer.toString("utf8"));
            return { mime: "application/json", ext: "json" };
        } catch {
            // fall through
        }
    }

    return null;
}
