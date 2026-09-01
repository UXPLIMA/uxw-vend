import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

export async function GET() {
    const items = await prisma.sliderItem.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
    });
    return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
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
