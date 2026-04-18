import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { generateSlug } from "@/core/lib/utils";
import { sanitizeHtml } from "@/core/lib/sanitize";

// GET /api/v1/custom-pages
export async function GET() {
    const pages = await prisma.customPage.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        select: { id: true, title: true, slug: true, isActive: true, order: true, createdAt: true },
    });
    return NextResponse.json({ pages });
}

// POST /api/v1/custom-pages - Admin
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { title, content, isActive, order } = body;

    if (!title || !content) {
        return NextResponse.json({ error: "Title and content required" }, { status: 400 });
    }

    let slug = body.slug || generateSlug(title);
    const existing = await prisma.customPage.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const page = await prisma.customPage.create({
        data: { title, slug, content: sanitizeHtml(content), isActive: isActive ?? true, order: order || 0 },
    });

    return NextResponse.json({ page }, { status: 201 });
}
