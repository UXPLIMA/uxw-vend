import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/admin/search?q=... — Core search (users only, modules extend via their own APIs)
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const q = request.nextUrl.searchParams.get("q") || "";
    if (q.length < 2) return NextResponse.json({ results: [] });

    const users = await prisma.user.findMany({
        where: { OR: [
            { username: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
        ]},
        select: { id: true, username: true, email: true },
        take: 10,
    });

    const results = users.map((u) => ({
        type: "user",
        id: u.id,
        title: u.username,
        subtitle: u.email,
        href: `/admin/users/${u.id}`,
    }));

    return NextResponse.json({ results });
}
