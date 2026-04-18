import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { slugify } from "@/core/lib/utils";
import { helpCategorySchema } from "../../../lib/validations";

// GET /api/v1/help/categories - List categories
export async function GET() {
    const categories = await prisma.helpCategory.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: {
            _count: { select: { articles: true } },
        },
    });

    return NextResponse.json(categories);
}

// POST /api/v1/help/categories - Create category (admin)
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
    const validation = helpCategorySchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json(
            { error: "Validation failed", details: validation.error.flatten() },
            { status: 400 }
        );
    }

    const { name, slug, description, icon, image, order } = validation.data;
    const categorySlug = slug || slugify(name);

    const category = await prisma.helpCategory.create({
        data: {
            name,
            slug: categorySlug,
            description,
            icon,
            image,
            order: order || 0,
        },
    });

    return NextResponse.json(category, { status: 201 });
}
