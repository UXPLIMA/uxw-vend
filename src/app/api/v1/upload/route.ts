import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { rateLimit, getClientIP } from "@/core/lib/rate-limit";
import { uploadFile, UPLOAD_ALLOWED_MIME, UPLOAD_MAX_SIZE } from "@/core/lib/storage";
import { prisma } from "@/core/lib/db";
import { log } from "@/core/lib/logger";

/**
 * POST /api/v1/upload
 *
 * Generic file upload endpoint. Accepts multipart/form-data with a `file` field.
 * Admin-only, rate-limited. Returns { url, path } on success.
 */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIP(request.headers);
    const rl = await rateLimit(`upload:${session.user.id}:${ip}`, {
        maxRequests: 20,
        windowMs: 60_000,
    });
    if (!rl.success) {
        return NextResponse.json({ error: "Too many uploads, slow down" }, { status: 429 });
    }

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const blob = file as File;

    // Before the body is read, not after. `uploadFile` refuses anything too
    // large or of the wrong type, but it is handed a Buffer, and building
    // that Buffer is what costs the memory: every other upload route on this
    // site - modules, themes, module updates - checks the size it was told
    // before it reads the bytes, and this one did not. The checks below are
    // the same limits, applied a step earlier; storage.ts still verifies the
    // type against the file's own magic bytes, which a header cannot fake.
    if (blob.size > UPLOAD_MAX_SIZE) {
        return NextResponse.json({ error: "File too large" }, { status: 413 });
    }
    if (!UPLOAD_ALLOWED_MIME.has(blob.type)) {
        return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());

    try {
        const result = await uploadFile(buffer, blob.name, blob.type);

        // Record in the central media library
        try {
            await prisma.mediaItem.create({
                data: {
                    filename: blob.name,
                    url: result.url,
                    storagePath: result.path,
                    mimeType: blob.type || "application/octet-stream",
                    size: blob.size,
                    uploadedById: session.user.id,
                },
            });
        } catch (err) {
            log.error("[upload] Failed to record media library entry", { error: err instanceof Error ? err.message : String(err) });
        }

        return NextResponse.json(result);
    } catch (err) {
        // The three refusals below are storage's own vocabulary, matched
        // here and answered in words chosen here, so what a reader sees is
        // visible at the point it is sent rather than borrowed from a throw.
        const message = err instanceof Error ? err.message : "Upload failed";
        if (message === "File too large") {
            return NextResponse.json({ error: "File too large" }, { status: 413 });
        }
        if (message === "Invalid file type") {
            return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
        }
        if (message === "Invalid filename") {
            return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
        }
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
