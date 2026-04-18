import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { blogCategorySchema } from "../../lib/validations";
import { generateSlug } from "@/core/lib/utils";

// GET /api/v1/blog/categories - List all categories (public)
export async function GET() {
    const categories = await prisma.blogCategory.findMany({
        orderBy: { name: "asc" },
        include: {
            _count: {
                select: { articles: true },
            },
        },
    });

    return NextResponse.json(categories);
}

// POST /api/v1/blog/categories - Create new category (admin only)
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
    const validation = blogCategorySchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json(
            { error: "Validation failed", details: validation.error.flatten() },
            { status: 400 }
        );
    }

    const { name, description } = validation.data;
    const slug = body.slug || generateSlug(name);

    // Check if slug already exists
    const existingCategory = await prisma.blogCategory.findUnique({ where: { slug } });
    if (existingCategory) {
        return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
    }

    const category = await prisma.blogCategory.create({
        data: { name, slug, description },
    });

    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("blog.category.created", category);

    return NextResponse.json(category, { status: 201 });
}
