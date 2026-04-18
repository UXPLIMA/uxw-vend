import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { rateLimitForRoleAsync } from "@/core/lib/rate-limit";
import { canDownload } from "../../lib/can-download";

type RouteParams = { params: Promise<{ id: string }> };

// GET - Increment download count and return file URL
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    const session = await auth();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
    const rlKey = `download:${session?.user?.id ?? "anon"}:${ip}`;
    const allowed = await rateLimitForRoleAsync(
        rlKey,
        { maxRequests: 30, windowMs: 60_000 },
        session?.user?.role
    );
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const download = await prisma.download.findUnique({ where: { id } });
    if (!download) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Validate URL to prevent path traversal and SSRF
    if (download.fileUrl && !download.fileUrl.startsWith('https://')) {
        return NextResponse.json({ error: "Invalid download URL" }, { status: 400 });
    }

    // Granular gate — if any ResourcePermission rows exist for this specific
    // download, require the caller to have been granted access. When no
    // grants exist, the download remains open (existing behavior preserved).
    const restricted = await prisma.resourcePermission.count({
        where: { resource: "downloads.download", resourceId: id },
    });
    if (restricted > 0) {
        if (!(await canDownload(session?.user?.id, id))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    await prisma.download.update({ where: { id }, data: { downloads: { increment: 1 } } });

    // Fire hook + activity feed entry
    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("downloads.file.downloaded", {
        downloadId: download.id,
        title: download.title,
        fileName: download.fileName,
        userId: session?.user?.id ?? null,
    });
    if (session?.user?.id) {
        await prisma.activityFeedItem.create({
            data: {
                type: "downloads.file.downloaded",
                actorId: session.user.id,
                title: `Downloaded ${download.title}`,
                icon: "Download",
                isPublic: true,
            },
        }).catch(() => {});
    }

    return NextResponse.json({ url: download.fileUrl });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const download = await prisma.download.update({ where: { id }, data: body });
    return NextResponse.json({ download });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    await prisma.download.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
}
