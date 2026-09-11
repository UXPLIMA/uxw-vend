import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { downloadCreateSchema } from "../lib/validations";
import { downloadSlug } from "../lib/guide";

export async function GET() {
    // The guide is not in this response. The list renders none of it and it
    // is a page's worth of markup per row; what the list needs is whether
    // there is a page to link to.
    const rows = await prisma.download.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        // The page renders every row it is given, so this is the ceiling on
        // one response rather than a page size.
        take: 200,
        select: {
            id: true, number: true, slug: true, title: true, description: true,
            fileName: true, fileSize: true, downloads: true, createdAt: true,
            details: true,
        },
    });
    const downloads = rows.map(({ details, ...row }) => ({
        ...row,
        hasGuide: typeof details === "string" && details.trim() !== "",
    }));
    return NextResponse.json({ downloads });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const parsed = downloadCreateSchema.safeParse(jsonBody);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }
    const { title, description, fileName, fileUrl, fileSize, details, coverImage } = parsed.data;

    const { sanitizeHtml } = await import("@/core/sdk/server");
    const download = await prisma.download.create({
        data: {
            title,
            slug: downloadSlug(title),
            description: description || null,
            // Sanitised on the way in: an admin account is a trust boundary,
            // not a guarantee, and this is rendered to every visitor.
            details: details ? sanitizeHtml(details) : null,
            coverImage: coverImage || null,
            fileName,
            fileUrl,
            fileSize: fileSize || null,
        },
    });
    return NextResponse.json({ download }, { status: 201 });
}
