import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { forumCategorySchema } from "../../lib/validations";
import { generateSlug } from "@/core/lib/utils";

// GET /api/v1/forum/categories
export async function GET() {
    const categories = await prisma.forumCategory.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: {
            _count: { select: { topics: true } },
        },
    });

    return NextResponse.json({ categories });
}

// POST /api/v1/forum/categories
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = forumCategorySchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { name, description, icon, color, order, isActive } = validation.data;
    const slug = body.slug || generateSlug(name);

    const existing = await prisma.forumCategory.findUnique({ where: { slug } });
    if (existing) {
        return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
    }

    const category = await prisma.forumCategory.create({
        data: { name, slug, description, icon, color, order: order || 0, isActive: isActive ?? true },
    });

    return NextResponse.json({ category }, { status: 201 });
}
