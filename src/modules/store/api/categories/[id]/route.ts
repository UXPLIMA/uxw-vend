import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { categorySchema } from "@/core/lib/validations";
import { generateSlug } from "@/core/lib/utils";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/store/categories/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    const category = await prisma.category.findFirst({
        where: { OR: [{ id }, { slug: id }] },
        include: {
            children: true,
            _count: { select: { products: true } },
        },
    });

    if (!category) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ category });
}

// PATCH /api/v1/store/categories/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = categorySchema.partial().safeParse(body);

    if (!validation.success) {
        return NextResponse.json(
            { error: validation.error.issues[0].message },
            { status: 400 }
        );
    }

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = { ...validation.data };

    if (data.name && !data.slug) {
        const newSlug = generateSlug(data.name as string);
        const slugExists = await prisma.category.findFirst({
            where: { slug: newSlug, id: { not: id } },
        });
        if (!slugExists) data.slug = newSlug;
    }

    const category = await prisma.category.update({
        where: { id },
        data,
        include: { children: true },
    });

    return NextResponse.json({ category });
}

// DELETE /api/v1/store/categories/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Move products and children to no category
    await prisma.product.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
    });
    await prisma.category.updateMany({
        where: { parentId: id },
        data: { parentId: null },
    });

    await prisma.category.delete({ where: { id } });

    return NextResponse.json({ message: "Category deleted" });
}
