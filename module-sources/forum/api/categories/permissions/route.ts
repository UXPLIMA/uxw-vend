import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { z } from "zod";

/**
 * The matrix: which roles may do what in which category.
 *
 * Written whole rather than a line at a time. An operator ticking boxes in a
 * grid is making one decision, and saving it row by row means a half-applied
 * matrix if the screen is closed in the middle - which for a permission is a
 * category that is briefly open to the wrong people.
 */
const matrixSchema = z.object({
    categoryId: z.string().min(1).max(64),
    rules: z.array(z.object({
        roleId: z.string().min(1).max(64),
        canView: z.boolean(),
        canPost: z.boolean(),
        canReply: z.boolean(),
    })).max(100),
});

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const categoryId = request.nextUrl.searchParams.get("categoryId");
    const rules = await prisma.forumCategoryPermission.findMany({
        where: categoryId ? { categoryId } : {},
        take: 2000,
    });
    return NextResponse.json({ rules }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const parsed = matrixSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { categoryId, rules } = parsed.data;

    const category = await prisma.forumCategory.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Replaced in one transaction. A matrix half written is a category open to
    // the wrong people for as long as it takes somebody to notice.
    await prisma.$transaction([
        prisma.forumCategoryPermission.deleteMany({ where: { categoryId } }),
        ...(rules.length > 0
            ? [prisma.forumCategoryPermission.createMany({
                data: rules.map((rule) => ({ ...rule, categoryId })),
            })]
            : []),
    ]);

    return NextResponse.json({ rules });
}
