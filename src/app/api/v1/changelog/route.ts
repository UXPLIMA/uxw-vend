import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

export async function GET() {
    const entries = await prisma.changelogEntry.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { version, title, content, type } = await request.json();
    if (!version || !title || !content) return NextResponse.json({ error: "Version, title and content required" }, { status: 400 });

    const entry = await prisma.changelogEntry.create({
        data: { version, title, content, type: type || "update" },
    });
    return NextResponse.json({ entry }, { status: 201 });
}
