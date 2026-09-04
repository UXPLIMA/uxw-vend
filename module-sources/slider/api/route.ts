import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

// GET /api/v1/slider - Slides for the homepage widget, or every slide for
// the admin screen. An admin that only ever saw the active ones had no way
// back to a slide they had just switched off.
export async function GET() {
    const session = await auth();
    const admin = session?.user?.id ? await isAdmin(session.user.id) : false;
    const items = await prisma.sliderItem.findMany({
        where: admin ? {} : { isActive: true },
        orderBy: { order: "asc" },
    });
    return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const item = await prisma.sliderItem.create({
        data: {
            title: body.title || null,
            subtitle: body.subtitle || null,
            image: body.image,
            link: body.link || null,
            order: body.order || 0,
            isActive: body.isActive ?? true,
        },
    });
    return NextResponse.json({ item }, { status: 201 });
}
