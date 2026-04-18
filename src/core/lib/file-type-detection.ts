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

function startsWith(buffer: Buffer, prefix: number[], offset = 0): boolean {
    if (buffer.length < offset + prefix.length) return false;
    for (let i = 0; i < prefix.length; i++) {
        if (buffer[offset + i] !== prefix[i]) return false;
    }
    return true;
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
