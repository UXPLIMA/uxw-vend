import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

export async function GET() {
    const downloads = await prisma.download.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ downloads });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { title, description, fileName, fileUrl, fileSize } = await request.json();
    if (!title || !fileName || !fileUrl) return NextResponse.json({ error: "Title, fileName and fileUrl required" }, { status: 400 });

    const download = await prisma.download.create({
        data: { title, description: description || null, fileName, fileUrl, fileSize: fileSize || null },
    });
    return NextResponse.json({ download }, { status: 201 });
}
