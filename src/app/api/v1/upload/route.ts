import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { rateLimit, getClientIP } from "@/core/lib/rate-limit";
import { uploadFile } from "@/core/lib/storage";
import { prisma } from "@/core/lib/db";

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
            console.error("[upload] Failed to record media library entry:", err);
        }

        return NextResponse.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        if (message === "File too large") {
            return NextResponse.json({ error: message }, { status: 413 });
        }
        if (message === "Invalid file type" || message === "Invalid filename") {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
