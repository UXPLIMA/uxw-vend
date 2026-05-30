import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { categorySchema } from "../../lib/validations";
import { slugify } from "@/core/lib/utils";
import { isAdmin } from "@/core/lib/permissions";
import { sanitizeHtml } from "@/core/lib/sanitize";

// GET /api/v1/store/categories - List categories
export async function GET() {
    try {
        const categories = await prisma.category.findMany({
            where: { isActive: true },
            include: {
                _count: {
                    select: { products: { where: { isActive: true } } },
                },
                children: {
                    where: { isActive: true },
                    select: { id: true, name: true, slug: true, image: true, description: true },
                },
            },
            orderBy: { order: "asc" },
        });

        return NextResponse.json({ categories });
    } catch (error) {
        console.error("List categories error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// POST /api/v1/store/categories - Create category (admin)
export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const adminCheck = await isAdmin(session.user.id);
        if (!adminCheck) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const validation = categorySchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            );
        }

        const data = validation.data;
        const slug = data.slug || slugify(data.name);

        const existing = await prisma.category.findUnique({ where: { slug } });
        if (existing) {
            return NextResponse.json(
                { error: "A category with this slug already exists" },
                { status: 400 }
            );
        }

        const category = await prisma.category.create({
            data: {
                name: data.name,
                slug,
                description: data.description !== undefined ? sanitizeHtml(data.description) : data.description,
                image: data.image,
                parentId: data.parentId,
                order: data.order ?? 0,
                isActive: data.isActive ?? true,
            },
        });

        return NextResponse.json({ category }, { status: 201 });
    } catch (error) {
        console.error("Create category error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
