import { NextRequest, NextResponse } from "next/server";
import { visibleCategoryIds } from "../../lib/visible-categories";
import { generateSlug } from "@/core/sdk";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { forumCategorySchema } from "../../lib/validations";
import { denyGuestView } from "../../lib/guest-view";

// GET /api/v1/forum/categories
export async function GET() {
    const denied = await denyGuestView();
    if (denied) return denied;

    // A private category has more than one door, and this is the front one.
    const reader = await auth();
    const readable = await visibleCategoryIds(reader?.user?.role ?? null);
    const categories = await prisma.forumCategory.findMany({
        where: {
            isActive: true,
            ...(readable.everything ? {} : { id: { in: readable.categoryIds } }),
        },
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

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const validation = forumCategorySchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { name, slug: requestedSlug, description, icon, color, order, isActive } = validation.data;
    const slug = requestedSlug || generateSlug(name);

    const existing = await prisma.forumCategory.findUnique({ where: { slug } });
    if (existing) {
        return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
    }

    const category = await prisma.forumCategory.create({
        data: { name, slug, description, icon, color, order: order || 0, isActive: isActive ?? true },
    });

    return NextResponse.json({ category }, { status: 201 });
}
