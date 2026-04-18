import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET - Admin: all applications, User: own applications
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminCheck = await isAdmin(session.user.id);
    const where = adminCheck ? {} : { userId: session.user.id };

    const applications = await prisma.staffApplication.findMany({
        where,
        include: { user: { select: { id: true, username: true, avatar: true, email: true } } },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ applications });
}

// POST - Submit application
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { position, content } = await request.json();
    if (!position || !content) return NextResponse.json({ error: "Position and content required" }, { status: 400 });

    // Check for existing pending application
    const existing = await prisma.staffApplication.findFirst({
        where: { userId: session.user.id, status: "pending" },
    });
    if (existing) return NextResponse.json({ error: "You already have a pending application" }, { status: 400 });

    const application = await prisma.staffApplication.create({
        data: { userId: session.user.id, position, content },
    });
    return NextResponse.json({ application }, { status: 201 });
}
