import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { createReadStream } from "fs";
import path from "path";
import { Readable } from "stream";

/**
 * Serves runtime-uploaded files from public/uploads/.
 *
 * Next.js App Router + Turbopack production builds bake the public/
 * directory contents into a manifest at build time. Files written to
 * public/uploads/ *after* the build (e.g. by the admin media library)
 * are NOT served by Next.js' static handler — they fall through to the
 * catch-all [...slug] page and get rendered as HTML.
 *
 * This route takes the `/uploads/*` URL namespace and streams the file
 * bytes directly from disk with the correct Content-Type, restoring the
 * behaviour users expect from a persistent media library.
 *
 * Security: path traversal guard ensures the resolved path stays inside
 * the uploads directory.
 */

const UPLOADS_DIR = path.resolve(process.cwd(), "public", "uploads");

const MIME_BY_EXT: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".avif": "image/avif",
    ".bmp": "image/bmp",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".json": "application/json",
    ".zip": "application/zip",
};

function contentTypeFor(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    return MIME_BY_EXT[ext] || "application/octet-stream";
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ path: string[] }> },
) {
    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length === 0) {
        return new NextResponse("Not found", { status: 404 });
    }

    // Reject dot segments + absolute paths up-front
    for (const seg of pathSegments) {
        if (!seg || seg === "." || seg === ".." || seg.includes("/") || seg.includes("\\")) {
            return new NextResponse("Invalid path", { status: 400 });
        }
    }

    const requested = path.join(...pathSegments);
    const filePath = path.resolve(UPLOADS_DIR, requested);

    // Defence in depth: resolved path must stay inside UPLOADS_DIR
    if (!filePath.startsWith(UPLOADS_DIR + path.sep)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    let stat;
    try {
        stat = await fs.stat(filePath);
    } catch {
        return new NextResponse("Not found", { status: 404 });
    }
    if (!stat.isFile()) {
        return new NextResponse("Not found", { status: 404 });
    }

    const stream = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream<Uint8Array>;

    return new NextResponse(stream, {
        status: 200,
        headers: {
            "Content-Type": contentTypeFor(requested),
            "Content-Length": String(stat.size),
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
