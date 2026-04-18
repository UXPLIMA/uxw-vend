import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/vote - List vote sites
export async function GET() {
    const sites = await prisma.voteSite.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: { _count: { select: { votes: true } } },
    });
    return NextResponse.json({ sites });
}

// POST /api/v1/vote - Create vote site (admin)
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { name, url, reward, icon } = body;

    if (!name || !url) {
        return NextResponse.json({ error: "Name and URL required" }, { status: 400 });
    }

    const site = await prisma.voteSite.create({
        data: { name, url, reward: reward || 0, icon: icon || null },
    });

    return NextResponse.json({ site }, { status: 201 });
}
