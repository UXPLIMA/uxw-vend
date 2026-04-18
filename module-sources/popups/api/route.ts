import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

export async function GET() {
    const now = new Date();
    const popups = await prisma.popup.findMany({
        where: {
            isActive: true,
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
            AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
        orderBy: { createdAt: "desc" },
        take: 1,
    });
    return NextResponse.json({ popups });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const popup = await prisma.popup.create({
        data: {
            title: body.title,
            content: body.content || null,
            image: body.image || null,
            link: body.link || null,
            linkText: body.linkText || null,
            isActive: body.isActive ?? true,
            startsAt: body.startsAt ? new Date(body.startsAt) : null,
            endsAt: body.endsAt ? new Date(body.endsAt) : null,
        },
    });
    return NextResponse.json({ popup }, { status: 201 });
}
